function drawUVTrendChart() {
  const canvas = document.getElementById("uvTrendChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const values = [0, 0, 1, 2, 4, 6, 8, 9, 8, 6, 4, 2, 1];
  const labels = ["6AM", "7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM"];

  ctx.clearRect(0, 0, w, h);

  const left = 60;
  const top = 20;
  const chartW = w - 90;
  const chartH = h - 70;

  ctx.strokeStyle = "#dbe2ee";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, chartW, chartH);

  const max = Math.max(...values, 1);

  ctx.beginPath();
  ctx.strokeStyle = "#2563ff";
  ctx.lineWidth = 4;

  values.forEach((value, index) => {
    const x = left + (index / (values.length - 1)) * chartW;
    const y = top + chartH - (value / max) * chartH;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = "#2563ff";
  values.forEach((value, index) => {
    const x = left + (index / (values.length - 1)) * chartW;
    const y = top + chartH - (value / max) * chartH;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#7b8498";
  ctx.font = "12px Arial";

  labels.forEach((label, index) => {
    if (index % 2 === 0) {
      const x = left + (index / (values.length - 1)) * chartW;
      ctx.fillText(label, x - 14, h - 20);
    }
  });

  ctx.fillStyle = "#6d7386";
  ctx.font = "13px Arial";
  ctx.fillText("Higher UV around midday", left, 16);
}

drawUVTrendChart();