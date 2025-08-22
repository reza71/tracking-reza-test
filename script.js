async function trackOrder() {
  const orderName = document.getElementById("orderInput").value;
  const resultEl = document.getElementById("result");

  if (!orderName) {
    resultEl.textContent = "Tolong masukkan Order Name!";
    return;
  }

  resultEl.textContent = "Loading...";

  try {
    const res = await fetch(`/api/getOrder?orderName=${orderName}`);
    const data = await res.json();

    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultEl.textContent = "Error: " + err.message;
  }
}
