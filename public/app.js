const dashboard = document.getElementById('dashboard');

// Dummy data generator – replace with WebSocket data
// const demoData = [
//   { value: 8.76, unit: 'V', mode: 'voltage-dc', hold: false, max: false, min: false, avg: true },
//   { value: 0.159, unit: 'V', mode: 'diode', hold: true, max: false, min: false, avg: false },
//   { value: 28.20, unit: 'mA', mode: 'current', hold: false, max: true, min: false, avg: false },
// ];

let i = 0;

function renderCard(data, idx) {
  const el = document.querySelector(`#card-${idx}`);
  if (!el) return;

  el.querySelector('.value').textContent = data.value;
  el.querySelector('.unit').textContent = data.unit;

  ['hold', 'avg'].forEach(flag => {
    const f = el.querySelector(`.flag[data-flag="${flag}"]`);
    f.classList.toggle('active', data[flag]);
  });
}

function createCard(data, idx) {
  const div = document.createElement('div');
  div.className = 'card';
  div.id = `card-${idx}`;
  div.innerHTML = `
    <div class="mode">${data.mode}</div>
    <div class="value">${data.value}</div>
    <div class="unit">${data.unit}</div>
    <div class="flags">
      <div class="flag" data-flag="hold">HOLD</div>
      <div class="flag" data-flag="avg">AVG</div>
    </div>
  `;
  dashboard.appendChild(div);
}

//demoData.forEach(createCard);
// setInterval(() => {
//   i = (i + 1) % demoData.length;
//   demoData.forEach((d, idx) => {
//     const updated = { ...d, value: (d.value + Math.random()).toFixed(3) };
//     renderCard(updated, idx);
//   });
// }, 1000);



const socket = new WebSocket('ws://localhost:3000');

const testdata = { value: 8.76, unit: 'V', mode: 'voltage-dc', hold: false, max: false, min: false, avg: false };
createCard(testdata, "meter1");
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  renderCard(data, "meter1");
};
