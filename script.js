document.getElementById("trackBtn").addEventListener("click", async () => {
  const orderNumber = document.getElementById("orderNumber").value;
  const resultDiv = document.getElementById("result");

  if (!orderNumber) {
    resultDiv.textContent = "Harap masukkan nomor order.";
    return;
  }

  try {
    const res = await fetch(`/api/getOrder?orderNumber=${orderNumber}`);
    const data = await res.json();

    if (data.error) {
      resultDiv.textContent = `Error: ${data.error}`;
    } else {
      resultDiv.textContent = JSON.stringify(data, null, 2);
    }
  } catch (err) {
    resultDiv.textContent = "Gagal fetch data order.";
    console.error(err);
  }
});
