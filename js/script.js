const defaultWorkers = [
  { id: "w1", name: "Ali Khan", skill: "Plumber", price: 500, img: "https://images.unsplash.com/photo-1581091014534-3e89df7cf2a5?q=80&w=400&auto=format&fit=crop", distanceKm: 2.5, rating: 4.6, description: "Expert in leak fixes, fitting, and bathroom installations.", experience: "8+ years", completedJobs: 150 },
  { id: "w2", name: "Sara Patel", skill: "Mehndi Artist", price: 1200, img: "https://images.unsplash.com/photo-1564540583246-934409427776?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 4.0, rating: 4.9, description: "Bridal and party mehndi with custom designs.", experience: "5+ years", completedJobs: 200 },
  { id: "w3", name: "Rohit Sharma", skill: "Painter", price: 800, img: "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 1.5, rating: 4.4, description: "Interior/exterior painting, quick finish, neat work.", experience: "6+ years", completedJobs: 120 },
  { id: "w4", name: "Rajesh Kumar", skill: "Electrician", price: 600, img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 3.2, rating: 4.7, description: "Expert in wiring, repairs, and electrical installations.", experience: "10+ years", completedJobs: 180 },
  { id: "w5", name: "Priya Singh", skill: "Home Food", price: 400, img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 1.8, rating: 4.8, description: "Delicious home-cooked meals, fresh and hygienic.", experience: "3+ years", completedJobs: 300 },
  { id: "w6", name: "Amit Verma", skill: "Mechanic", price: 700, img: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 2.1, rating: 4.5, description: "Car and bike repairs, quick service, genuine parts.", experience: "7+ years", completedJobs: 90 },
  { id: "w7", name: "Neha Gupta", skill: "Beauty Expert", price: 800, img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 2.8, rating: 4.8, description: "Professional beauty services, makeup, and skincare.", experience: "4+ years", completedJobs: 250 },
  { id: "w8", name: "Vikram Singh", skill: "Carpenter", price: 600, img: "https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=400&h=300&auto=format&fit=crop", distanceKm: 3.5, rating: 4.6, description: "Custom furniture, repairs, and woodwork.", experience: "9+ years", completedJobs: 110 },
];

function getStoredWorkers() {
  try {
    const raw = localStorage.getItem('nearnect_workers');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveStoredWorkers(workers) {
  localStorage.setItem('nearnect_workers', JSON.stringify(workers));
}

function getAllWorkers() {
  const stored = getStoredWorkers();
  // Merge by id, stored overrides defaults
  const byId = new Map();
  defaultWorkers.forEach(w => byId.set(w.id, w));
  stored.forEach(w => byId.set(w.id || `stored_${Math.random().toString(36).slice(2)}`, w));
  return Array.from(byId.values());
}

function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: (params.get('q') || '').trim().toLowerCase(),
    cat: (params.get('cat') || '').trim().toLowerCase(),
    maxd: parseFloat(params.get('maxd') || '') || null,
  };
}

function matchesQuery(worker, q) {
  if (!q) return true;
  const hay = `${worker.name} ${worker.skill} ${worker.description || ''}`.toLowerCase();
  return hay.includes(q);
}

function starHtml(rating) {
  if (!rating) return '';
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '<span class="stars">' + '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty) + ` <span class="score">(${rating.toFixed(1)})</span>` + '</span>';
}

function renderWorkers() {
  const container = document.getElementById('workerCards');
  const resultsCount = document.getElementById('resultsCount');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;
  
  const { q, cat, maxd } = parseQuery();
  let workers = getAllWorkers().filter(w => matchesQuery(w, q));
  if (cat) {
    workers = workers.filter(w => (w.skill || '').toLowerCase().includes(cat));
  }
  if (maxd != null) {
    workers = workers.filter(w => typeof w.distanceKm === 'number' && w.distanceKm <= maxd);
  }
  
  // Update results count
  if (resultsCount) {
    resultsCount.textContent = `${workers.length} worker${workers.length !== 1 ? 's' : ''} found`;
  }
  
  container.innerHTML = '';
  if (workers.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  
         workers.forEach((worker, index) => {
           const card = document.createElement('div');
           card.className = 'worker-card premium-worker-card fade-in-up';
           card.style.transitionDelay = `${index * 0.1}s`;
  card.innerHTML = `
             <div class="worker-image">
               <img src="${worker.img}" alt="${worker.skill}" onerror="this.onerror=null;this.src='https://source.unsplash.com/400x300/?services,people';">
               <div class="worker-badges">
                 <div class="rating-badge">${starHtml(worker.rating)}</div>
                 <div class="price-badge">₹${worker.price}</div>
               </div>
               <div class="worker-overlay">
                 <div class="experience-badge">${worker.experience || '5+ years'}</div>
                 <div class="jobs-badge">${worker.completedJobs || 100}+ jobs</div>
               </div>
             </div>
             <div class="worker-content">
               <h3 class="worker-name">${worker.name}</h3>
               <p class="worker-skill">${worker.skill}</p>
               ${worker.description ? `<p class="worker-description">${worker.description}</p>` : ''}
               <div class="worker-meta">
                 <div class="worker-distance">📍 ${worker.distanceKm || 'N/A'} km away</div>
                 <div class="worker-availability">
                   <span class="status-dot"></span>
                   Available Now
                 </div>
               </div>
               <div class="worker-stats">
                 <div class="stat">
                   <span class="stat-number">${worker.completedJobs || 100}+</span>
                   <span class="stat-label">Jobs Done</span>
                 </div>
                 <div class="stat">
                   <span class="stat-number">${worker.rating}</span>
                   <span class="stat-label">Rating</span>
                 </div>
                 <div class="stat">
                   <span class="stat-number">${worker.experience || '5+'}</span>
                   <span class="stat-label">Experience</span>
                 </div>
               </div>
               <div class="worker-actions">
                 <button class="btn-primary book-btn" data-id="${worker.id}">
                   <span>Book Now</span>
                   <i>→</i>
                 </button>
                 <button class="btn-secondary">
                   <span>View Profile</span>
                 </button>
               </div>
             </div>
           `;
           container.appendChild(card);
         });

  container.addEventListener('click', function(e) {
    const btn = e.target.closest('.book-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const selected = getAllWorkers().find(w => w.id === id);
    if (selected) {
      localStorage.setItem('nearnect_selected_worker', JSON.stringify(selected));
      // Check if user is logged in
      const currentUser = localStorage.getItem('nearnect_current_user');
      if (currentUser) {
        window.location.href = `payment.html?workerId=${id}`;
      } else {
        // Redirect to login first
        if (confirm('Please login to book a service. Do you want to login now?')) {
          window.location.href = 'login.html';
        }
      }
    }
  });
}

// Initialize when on user listing page
if (document.getElementById('workerCards')) {
  renderWorkers();
}
