import { db } from './db'
import type { Competition } from './types'

/** Hardcoded competitions. Seeded into DB on app load if not already present. */
export const DEFAULT_COMPETITIONS: Competition[] = [
  {
    id: 'durham-college',
    name: 'Durham College',
    teamNumbers: [
      188, 781, 1241, 2708, 3543, 4152, 4476, 4946, 4976, 5024, 5032, 5036,
      5409, 5596, 5689, 5870, 6135, 7480, 7603, 7712, 7757, 7902, 8089, 8729,
      9569, 9589, 10015, 11227,
    ],
    teamNames: {
      188: 'Blizzard',
      781: 'Kinetic Knights',
      1241: 'THEORY6',
      2708: 'Lake Effect Robotics',
      3543: 'C4 Robotics',
      4152: 'Hoya Robotics',
      4476: 'W.A.F.F.L.E.S.',
      4946: 'The Alpha Dogs',
      4976: 'Revolt Robotics',
      5024: 'Raider Robotics',
      5032: 'The Falcons',
      5036: 'The Robo Devils',
      5409: 'Chargers',
      5596: 'Wolverine Robotics',
      5689: 'CK Cyber Pack',
      5870: 'League of Logic',
      6135: 'Arctos',
      7480: 'Machine Mavericks',
      7603: '7603 VESPA ROBOTICS',
      7712: 'ACCN UMOJA',
      7757: 'Atomic Dishwashers',
      7902: 'Markham FireBirds',
      8089: 'Rockway Robotics',
      8729: 'Sparkling H2O',
      9569: 'Milliken Mills Silver Knights',
      9589: 'Arcade Robotics',
      10015: 'Bubbles',
      11227: 'Goose Goose Duck',
    },
  },
  {
    id: 'north-bay',
    name: 'North Bay',
    teamNumbers: [
      610, 1305, 1334, 2013, 2609, 2706, 2708, 2935, 3543, 4152, 5036, 5596,
      6859, 6864, 7476, 7480, 7520, 7712, 8729, 8884, 9580, 9589, 9785, 10015,
      10924, 11270,
    ],
    teamNames: {
      610: 'Crescent Coyotes',
      1305: 'Ice Cubed',
      1334: 'Red Devils',
      2013: 'Cybergnomes',
      2609: 'Beaverworx',
      2706: 'Merge Robotics',
      2708: 'Lake Effect Robotics',
      2935: 'NACI Robotics',
      3543: 'C4 Robotics',
      4152: 'Hoya Robotics',
      5036: 'The Robo Devils',
      5596: 'Wolverine Robotics',
      6859: 'Big Metal Lakers 6859- BML Roboti',
      6864: 'GryphTech Robotics',
      7476: 'EOM Robotics 7476',
      7480: 'Machine Mavericks',
      7520: 'Team MineKee',
      7712: 'ACCN UMOJA',
      8729: 'Sparkling H2O',
      8884: 'Knight Owls',
      9580: 'Grizzly Gears',
      9589: 'Arcade Robotics',
      9785: 'Alectrona',
      10015: 'Bubbles',
      10924: 'Titanium Titans',
      11270: 'Nova',
    },
  },
]

export async function ensureDefaultCompetitions(): Promise<void> {
  for (const comp of DEFAULT_COMPETITIONS) {
    const existing = await db.competitions.get(comp.id)
    if (!existing) await db.competitions.put(comp)
  }
}
