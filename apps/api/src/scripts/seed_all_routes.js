const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Route = require('../modules/routes/route.model');
const { ROUTE_GROUPS, HUB_CITY } = require('../config/constants');

async function seedRoutes() {
  await connectDB();
  console.log('[Seed Routes] Checking routes in MongoDB...');

  let createdCount = 0;
  let updatedCount = 0;

  for (const group of ROUTE_GROUPS) {
    for (const city of group.cities) {
      const durationHours = parseFloat(city.duration) || 20;

      // 1. Outbound: Rupaidiha -> City
      const outboundFilter = {
        $or: [
          { 'fromCity.name': 'Rupaidiha' },
          { 'fromCity.name': 'Rupadiya' },
          { 'fromCity.id': 'rupaidiha' },
          { 'fromCity.id': 'rupadiya' }
        ],
        $and: [
          {
            $or: [
              { 'toCity.id': city.id },
              { 'toCity.name': new RegExp(`^${city.name}$`, 'i') }
            ]
          }
        ]
      };

      const outboundData = {
        name: `Rupaidiha - ${city.name} Corridor`,
        routeGroupId: group.id,
        routeName: group.name,
        fromCity: {
          id: 'rupaidiha',
          name: 'Rupaidiha',
          state: 'Uttar Pradesh'
        },
        toCity: {
          id: city.id,
          name: city.name,
          state: city.state
        },
        distanceKm: city.distanceKm || 1200,
        estimatedDurationHours: durationHours,
        baseFare: city.baseFare || 1650,
        boardingPoints: [
          { id: 'bp-rup-1', name: 'Rupaidiha Central Bus Terminal', timeOffsetMinutes: 0 },
          { id: 'bp-rup-2', name: 'Rupaidiha Border Gate Point', timeOffsetMinutes: 20 }
        ],
        droppingPoints: [
          { id: `dp-${city.id}-1`, name: `${city.name} Central Drop Stand`, timeOffsetMinutes: Math.round(durationHours * 60) },
          { id: `dp-${city.id}-2`, name: `${city.name} Express Bypass`, timeOffsetMinutes: Math.round(durationHours * 60) + 30 }
        ],
        isActive: true
      };

      const existingOut = await Route.findOne(outboundFilter);
      if (existingOut) {
        Object.assign(existingOut, outboundData);
        await existingOut.save();
        updatedCount++;
      } else {
        await Route.create(outboundData);
        createdCount++;
      }

      // 2. Inbound: City -> Rupaidiha
      const inboundFilter = {
        $or: [
          { 'toCity.name': 'Rupaidiha' },
          { 'toCity.name': 'Rupadiya' },
          { 'toCity.id': 'rupaidiha' },
          { 'toCity.id': 'rupadiya' }
        ],
        $and: [
          {
            $or: [
              { 'fromCity.id': city.id },
              { 'fromCity.name': new RegExp(`^${city.name}$`, 'i') }
            ]
          }
        ]
      };

      const inboundData = {
        name: `${city.name} - Rupaidiha Corridor`,
        routeGroupId: group.id,
        routeName: group.name,
        fromCity: {
          id: city.id,
          name: city.name,
          state: city.state
        },
        toCity: {
          id: 'rupaidiha',
          name: 'Rupaidiha',
          state: 'Uttar Pradesh'
        },
        distanceKm: city.distanceKm || 1200,
        estimatedDurationHours: durationHours,
        baseFare: city.baseFare || 1650,
        boardingPoints: [
          { id: `bp-${city.id}-1`, name: `${city.name} Central Bus Terminal`, timeOffsetMinutes: 0 }
        ],
        droppingPoints: [
          { id: 'dp-rup-1', name: 'Rupaidiha Central Bus Terminal', timeOffsetMinutes: Math.round(durationHours * 60) }
        ],
        isActive: true
      };

      const existingIn = await Route.findOne(inboundFilter);
      if (existingIn) {
        Object.assign(existingIn, inboundData);
        await existingIn.save();
        updatedCount++;
      } else {
        await Route.create(inboundData);
        createdCount++;
      }
    }
  }

  const totalRoutes = await Route.countDocuments();
  console.log(`[Seed Routes] Done! Created: ${createdCount}, Updated: ${updatedCount}, Total in DB: ${totalRoutes}`);
  await mongoose.disconnect();
}

seedRoutes().catch(err => {
  console.error('[Seed Routes Error]:', err);
  process.exit(1);
});

