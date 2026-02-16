/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Filter workers by distance from user location
 */
function filterByDistance(workers, userLat, userLon, maxDistanceKm = 10) {
  if (!userLat || !userLon) {
    return workers.map(w => ({ ...w, distanceKm: null }));
  }

  return workers
    .filter(worker => {
      if (!worker.latitude || !worker.longitude) {
        return false; // Exclude workers without location
      }
      const distance = calculateDistance(
        userLat,
        userLon,
        worker.latitude,
        worker.longitude
      );
      worker.distanceKm = distance;
      return distance <= maxDistanceKm;
    })
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0)); // Sort by distance
}

/**
 * Get workers within radius
 */
function getWorkersInRadius(workers, centerLat, centerLon, radiusKm) {
  return workers.filter(worker => {
    if (!worker.latitude || !worker.longitude) return false;
    const distance = calculateDistance(
      centerLat,
      centerLon,
      worker.latitude,
      worker.longitude
    );
    worker.distanceKm = distance;
    return distance <= radiusKm;
  });
}

module.exports = {
  calculateDistance,
  filterByDistance,
  getWorkersInRadius,
  toRad
};

