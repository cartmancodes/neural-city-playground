// Mock district master. Centers approximate Andhra Pradesh district seats.
// school_count is the expected fleet size used only for the Data Quality view;
// the live schools.js fixture is a sample subset.

export const districts = [
  { id: 'visakhapatnam', name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185, school_count: 1820 },
  { id: 'vizianagaram', name: 'Vizianagaram', lat: 18.1067, lng: 83.3956, school_count: 1240 },
  { id: 'srikakulam', name: 'Srikakulam', lat: 18.2949, lng: 83.8938, school_count: 1380 },
  { id: 'east_godavari', name: 'East Godavari', lat: 16.9891, lng: 82.2475, school_count: 1960 },
  { id: 'west_godavari', name: 'West Godavari', lat: 16.9174, lng: 81.3399, school_count: 1710 },
  { id: 'krishna', name: 'Krishna', lat: 16.5062, lng: 80.648, school_count: 1540 },
  { id: 'guntur', name: 'Guntur', lat: 16.3067, lng: 80.4365, school_count: 1890 },
  { id: 'prakasam', name: 'Prakasam', lat: 15.3485, lng: 79.5604, school_count: 1320 },
  { id: 'nellore', name: 'SPSR Nellore', lat: 14.4426, lng: 79.9865, school_count: 1210 },
  { id: 'chittoor', name: 'Chittoor', lat: 13.2172, lng: 79.1003, school_count: 1630 },
  { id: 'kadapa', name: 'YSR Kadapa', lat: 14.4673, lng: 78.8242, school_count: 1180 },
  { id: 'ananthapuramu', name: 'Ananthapuramu', lat: 14.6819, lng: 77.6006, school_count: 1450 },
  { id: 'kurnool', name: 'Kurnool', lat: 15.8281, lng: 78.0373, school_count: 1470 },
]

export const districtById = Object.fromEntries(districts.map((d) => [d.id, d]))
