async function test() {
    try {
        const res = await fetch('http://localhost:3001/api/couriers');
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}
test();
