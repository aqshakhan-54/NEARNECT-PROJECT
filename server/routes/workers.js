const express = require('express');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { calculateDistance, filterByDistance } = require('../utils/locationUtils');

const router = express.Router();

// GET /workers - Search and filter workers (public endpoint, but can use auth for personalized results)
router.get('/', async (req, res) => {
  try {
    const {
      search,
      skill,
      minPrice,
      maxPrice,
      minRating,
      location,
      availability,
      latitude,
      longitude,
      maxDistance = 10, // Default 10km radius
      limit = 20,
      page = 1,
      sort = 'rating' // rating, price, newest, distance
    } = req.query;

    // Build query - only get workers
    // NOTE: earlier we filtered out workers with empty skill.
    // That caused newly created worker accounts (without profile completed yet)
    // to never appear in search results. Now we include all workers by default
    // and rely on optional filters below.
    let query = { role: 'worker' };

    // Search by skill or name
    if (search) {
      query.$or = [
        { skill: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by specific skill
    if (skill) {
      query.skill = { $regex: skill, $options: 'i' };
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Filter by availability
    if (availability) {
      query.availability = { $regex: availability, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price':
        sortObj = { price: 1 }; // Ascending
        break;
      case 'price-desc':
        sortObj = { price: -1 }; // Descending
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'rating':
      default:
        sortObj = { createdAt: -1 }; // Will be sorted by rating after aggregation
        break;
    }

    // Get workers with basic info (including location)
    let workers = await User.find(query)
      .select('name email phone avatarUrl bio skill price availability latitude longitude address city pincode createdAt')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit) * 2); // Get more to filter by distance later

    // Get review stats for each worker
    const workersWithStats = await Promise.all(
      workers.map(async (worker) => {
        // Get reviews for this worker
        const reviews = await Review.find({
          workerId: worker._id,
          status: 'active'
        });

        // Calculate average rating
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

        // Count reviews
        const reviewCount = reviews.length;

        // Get completed bookings count
        const completedBookings = await Booking.countDocuments({
          workerId: worker._id,
          status: 'completed'
        });

        return {
          id: worker._id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          avatarUrl: worker.avatarUrl,
          bio: worker.bio,
          skill: worker.skill,
          price: worker.price,
          availability: worker.availability,
          rating: Math.round(avgRating * 10) / 10,
          reviewCount,
          completedBookings,
          joinedAt: worker.createdAt,
          latitude: worker.latitude,
          longitude: worker.longitude,
          address: worker.address,
          city: worker.city,
          pincode: worker.pincode,
          distanceKm: null // Will be calculated if location provided
        };
      })
    );

    // Filter by location/distance if coordinates provided
    let filteredWorkers = workersWithStats;
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLon = parseFloat(longitude);
      const maxDist = parseFloat(maxDistance) || 10;

      filteredWorkers = filterByDistance(workersWithStats, userLat, userLon, maxDist);
    }

    // Sort by rating if requested
    if (sort === 'rating') {
      filteredWorkers.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'distance' && latitude && longitude) {
      // Already sorted by distance in filterByDistance
      filteredWorkers.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    }

    // Filter by minimum rating if specified
    if (minRating) {
      filteredWorkers = filteredWorkers.filter(w => w.rating >= parseFloat(minRating));
    }

    // Limit results after filtering
    filteredWorkers = filteredWorkers.slice(0, parseInt(limit));

    // Get total count for pagination (after location filtering)
    const total = filteredWorkers.length;

    res.json({
      workers: filteredWorkers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      location: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        maxDistance: parseFloat(maxDistance) || 10
      } : null
    });
  } catch (err) {
    console.error('Search workers error:', err);
    res.status(500).json({ error: 'Failed to search workers' });
  }
});

// GET /workers/:id - Get specific worker profile with detailed stats
router.get('/:id', async (req, res) => {
  try {
    const worker = await User.findById(req.params.id)
      .select('name email phone avatarUrl bio skill price availability createdAt');

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    if (worker.role !== 'worker') {
      return res.status(400).json({ error: 'User is not a worker' });
    }

    // Get reviews
    const reviews = await Review.find({
      workerId: worker._id,
      status: 'active'
    })
      .populate('customerId', 'name email avatarUrl')
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate stats
    const allReviews = await Review.find({
      workerId: worker._id,
      status: 'active'
    });

    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    const ratingCounts = {
      5: allReviews.filter(r => r.rating === 5).length,
      4: allReviews.filter(r => r.rating === 4).length,
      3: allReviews.filter(r => r.rating === 3).length,
      2: allReviews.filter(r => r.rating === 2).length,
      1: allReviews.filter(r => r.rating === 1).length
    };

    // Get booking stats
    const bookingStats = await Booking.aggregate([
      { $match: { workerId: worker._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalBookings: bookingStats.reduce((sum, s) => sum + s.count, 0),
      completedBookings: bookingStats.find(s => s._id === 'completed')?.count || 0,
      pendingBookings: bookingStats.find(s => s._id === 'pending')?.count || 0
    };

    res.json({
      id: worker._id,
      _id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      avatarUrl: worker.avatarUrl,
      bio: worker.bio,
      skill: worker.skill,
      price: worker.price,
      availability: worker.availability,
      address: worker.address,
      city: worker.city,
      pincode: worker.pincode,
      joinedAt: worker.createdAt,
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: allReviews.length,
      ratingCounts,
      reviews,
      stats,
      completedBookings: stats.completedBookings
    });
  } catch (err) {
    console.error('Get worker profile error:', err);
    res.status(500).json({ error: 'Failed to fetch worker profile' });
  }
});

// GET /workers/skills/list - Get list of all available skills
router.get('/skills/list', async (req, res) => {
  try {
    const skills = await User.distinct('skill', {
      role: 'worker',
      skill: { $ne: '', $exists: true }
    });

    // Count workers per skill
    const skillsWithCount = await Promise.all(
      skills.map(async (skill) => {
        const count = await User.countDocuments({
          role: 'worker',
          skill: { $regex: skill, $options: 'i' }
        });
        return { skill, count };
      })
    );

    res.json(skillsWithCount.sort((a, b) => b.count - a.count));
  } catch (err) {
    console.error('Get skills list error:', err);
    res.status(500).json({ error: 'Failed to fetch skills list' });
  }
});

// GET /workers/nearby/count - Get count of services near user location
router.get('/nearby/count', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const maxDist = parseFloat(maxDistance);

    // Get all workers with location
    const workers = await User.find({
      role: 'worker',
      skill: { $ne: '' },
      latitude: { $ne: null, $exists: true },
      longitude: { $ne: null, $exists: true }
    }).select('latitude longitude skill');

    // Filter by distance
    const nearbyWorkers = filterByDistance(workers, userLat, userLon, maxDist);

    // Count by skill
    const skillCounts = {};
    nearbyWorkers.forEach(worker => {
      const skill = worker.skill || 'Other';
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });

    res.json({
      totalServices: nearbyWorkers.length,
      withinRadius: maxDist,
      location: {
        latitude: userLat,
        longitude: userLon
      },
      bySkill: skillCounts,
      services: nearbyWorkers.map(w => ({
        id: w._id,
        skill: w.skill,
        distanceKm: w.distanceKm
      }))
    });
  } catch (err) {
    console.error('Get nearby count error:', err);
    res.status(500).json({ error: 'Failed to get nearby services count' });
  }
});

module.exports = router;

