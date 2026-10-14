// Supplied design fixtures, not reporting. Dates are fixed example dates.
export const DEMO_DATE = '2026-10-14T12:00:00Z';
export const categories = { All: '#FFE438', Planet: '#4AE18B', Science: '#29D6DA', Community: '#42ACFF', Health: '#A1E6AF' };
const make = (id, title, location, category, lat, lng, image, date, summary) => ({
  id, version: 1, eventDate: null, datePrecision: null, archive: false, title, summary, category, location, lat, lng, image: '/assets/' + image + '.jpg', locationPrecision: 'city',
  publishedAt: date + 'T12:00:00Z', fetchedAt: DEMO_DATE, sourceName: null, sourceUrl: null,
  imageAlt: 'Illustrative ' + (image === 'wind' ? 'wind turbines' : image === 'city' ? 'city landscape' : 'coastline'), imageCredit: 'Unsplash · illustrative photograph', isDemo: true,
});
export const stories = [
  make('portugal', 'A coastline coming back to life', 'Portugal', 'Planet', 38.72, -9.14, 'coast', '2026-10-12', 'Imagine coastlines restored and nature making a comeback. This fictional story illustrates the design; it is not a report of a real event.'),
  make('kenya', 'A new chapter for clean energy', 'Kenya', 'Science', -1.29, 36.82, 'wind', '2026-10-10', 'An illustrative clean-energy story, created to explore the interface. No project launch, output figure, or factual news claim is being reported.'),
  make('new-york', 'Neighbors growing a greener city', 'New York', 'Community', 40.71, -74.01, 'city', '2026-10-08', 'A fictional example of neighbors improving their shared spaces. This sample shows how community reporting could appear.'),
  make('norway', 'Small ideas, brighter futures', 'Norway', 'Science', 59.91, 10.75, 'wind', '2026-10-03', 'An illustrative science story for testing navigation and filters. The photograph and headline are design samples.'),
  make('brazil', 'Making room for nature', 'Brazil', 'Planet', -3.12, -60.02, 'coast', '2026-09-30', 'A fictional example of environmental progress. Coordinates demonstrate globe navigation and do not identify a reported project.'),
  make('india', 'Care that brings people together', 'India', 'Health', 19.08, 72.88, 'city', '2026-10-11', 'An illustrative community-care story. No medical result or treatment claim is being made.'),
  make('japan', 'A neighborhood built on kindness', 'Japan', 'Community', 35.68, 139.65, 'city', '2026-09-22', 'A fictional neighborhood story for exploring another part of the planet. It has no associated publisher or original article.'),
  make('australia', 'A brighter future for our shores', 'Australia', 'Planet', -33.87, 151.21, 'coast', '2026-09-04', 'An older fictional sample. Choose All dates to include it. Dates are fixed examples and do not refresh to make this sample look new.'),
];
