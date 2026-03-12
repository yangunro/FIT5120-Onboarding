// server.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Root endpoint

app.get('/', (req, res) => {
  res.json({ message: 'UV API is running' });
});

// Helper: get location by postcode

async function getLocationByPostcode(postcode) {
  const query = `
    SELECT location_id, postcode, suburb, state, latitude, longitude
    FROM location
    WHERE CAST(postcode AS TEXT) = $1
    LIMIT 1
  `;
  const result = await pool.query(query, [postcode]);
  return result.rows[0] || null;
}

// Helper: fetch weather data from OpenWeather

async function fetchCurrentWeather(lat, lon) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is missing in .env');
  }

  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${lat}` +
    `&lon=${lon}` +
    `&exclude=minutely,hourly,daily,alerts` +
    `&units=metric` +
    `&appid=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenWeather API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// Helper: convert API response into observation object

function extractObservation(data) {
  const uvIndex = data.current?.uvi ?? null;
  const temperature = data.current?.temp ?? null;

  // use API observation time if available
  const observedAt = data.current?.dt
    ? new Date(data.current.dt * 1000)
    : new Date();

  const timezone = data.timezone ?? null;

  return {
    uvIndex,
    temperature,
    observedAt,
    timezone
  };
}

/*
  Helper: insert into uv_observation
*/
async function insertUvObservation(locationId, observedAt, uvIndex, temperature) {
  const query = `
    INSERT INTO uv_observation (location_id, observed_at, uv_index, temperature)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await pool.query(query, [
    locationId,
    observedAt,
    uvIndex,
    temperature
  ]);

  return result.rows[0];
}

/*
  GET current UV by postcode
  - fetch from API
  - insert into uv_observation
*/
app.get('/api/uv/:postcode', async (req, res) => {
  const { postcode } = req.params;

  try {
    // 1. find location
    const location = await getLocationByPostcode(postcode);

    if (!location) {
      return res.status(404).json({
        error: 'postcode not found in location table'
      });
    }

    const locationId = location.location_id;
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);

    // 2. fetch live weather / UV data
    const weatherData = await fetchCurrentWeather(lat, lon);

    // 3. extract useful fields
    const { uvIndex, temperature, observedAt, timezone } = extractObservation(weatherData);

    if (uvIndex === null || temperature === null) {
      return res.status(500).json({
        error: 'failed to get uv_index or temperature from weather api'
      });
    }

    // 4. insert observation into database
    const insertedRow = await insertUvObservation(
      locationId,
      observedAt,
      uvIndex,
      temperature
    );

    // 5. return response
    return res.json({
      message: 'UV observation inserted successfully',
      location: {
        location_id: location.location_id,
        postcode: location.postcode,
        suburb: location.suburb ?? null,
        state: location.state ?? null,
        latitude: lat,
        longitude: lon
      },
      observation: {
        uv_index: uvIndex,
        temperature: temperature,
        observed_at_utc: observedAt.toISOString(),
        timezone: timezone
      },
      inserted_data: insertedRow
    });
  } catch (error) {
    console.error('GET /api/uv/:postcode error:', error);

    return res.status(500).json({
      error: error.message
    });
  }
});

/*
  GET UV observation history by postcode
*/
app.get('/api/uv/:postcode/history', async (req, res) => {
  const { postcode } = req.params;

  try {
    const location = await getLocationByPostcode(postcode);

    if (!location) {
      return res.status(404).json({
        error: 'postcode not found in location table'
      });
    }

    const query = `
      SELECT uv_obs_id, location_id, observed_at, uv_index, temperature
      FROM uv_observation
      WHERE location_id = $1
      ORDER BY observed_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [location.location_id]);

    return res.json({
      location: {
        location_id: location.location_id,
        postcode: location.postcode,
        suburb: location.suburb ?? null,
        state: location.state ?? null
      },
      total: result.rows.length,
      history: result.rows
    });
  } catch (error) {
    console.error('GET /api/uv/:postcode/history error:', error);

    return res.status(500).json({
      error: error.message
    });
  }
});

/*
  Start server
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});