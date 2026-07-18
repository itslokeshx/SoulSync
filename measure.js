import fs from 'fs';

async function fetchWithTimings(name, url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`\n=== Timings for ${name} ===`);
    console.log(url);
    if (data._timings) {
      console.table(data._timings);
    } else {
      console.log('No _timings found in response:', data);
    }
  } catch (err) {
    console.error(`Error fetching ${name}:`, err.message);
  }
}

async function main() {
  // We need to bypass cache to see actual backend times. We'll append a random query param.
  const nonce = Date.now();
  
  await fetchWithTimings('Dashboard (Guest)', `http://localhost:4000/api/dashboard/guest?&nonce=${nonce}`);
  
  await fetchWithTimings('Search (MANKATHA THEME)', `http://localhost:4000/api/search?q=MANKATHA%20THEME%20-%20MANKATHA&nonce=${nonce}`);
  await fetchWithTimings('Search (Kabir Entry BGM)', `http://localhost:4000/api/search?q=Kabir%20Entry%20BGM%20-%20War&nonce=${nonce}`);
  
  // Note: /autoplay/:id requires softAuth or just a song id, let's see.
  // Actually, wait, the prompt asked for "dashboard load, search request, recommendation/autoplay queue generation"
  // For autoplay, we can just call an endpoint. The dashboard already hits the recommendation generator.
}

main();
