// testing api
const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

/*
test endpoint
*/
app.get('/', (req, res) => {
  res.json({ message: "UV API is running" });
});

// Get UV index by postcode
app.get('/api/uv/:postcode', async (req, res) => {
  const { postcode } = req.params;

  try {
    // 1. search latitude and longitude from table location
    const locationResult = await pool.query(
      `
      SELECT latitude, longitude
      FROM location
      WHERE postcode = $1
      LIMIT 1
      `,
      [postcode]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({
        error: "postcode not found"
      });
    }

    const { latitude, longitude } = locationResult.rows[0];
    const lat = Number(latitude);
    const lon = Number(longitude);

    // 2. call OpenWeather API
    const apiKey = process.env.OPENWEATHER_API_KEY;

    const url =
      `https://api.openweathermap.org/data/3.0/onecall` +
      `?lat=${lat}` +
      `&lon=${lon}` +
      `&exclude=minutely,hourly,daily,alerts` +
      `&appid=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({
        error: "weather api error"
      });
    }

    const data = await response.json();

    // 3. get current.uvi
    const uvIndex = data.current?.uvi ?? null;

    // 4. return result
    return res.json({
      postcode,
      latitude: lat,
      longitude: lon,
      uv_index: uvIndex
    });

  } catch (error) {
    console.error(error);

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