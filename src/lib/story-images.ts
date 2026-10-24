import type { Story } from '../types/index.ts';
export interface StoryPhoto {
  id: string; path: string; alt: string; credit: string; sourceUrl: string;
  licenseName: string; licenseUrl: string; kind: 'place' | 'illustration'; caption: string;
}
const commons = 'https://commons.wikimedia.org/wiki/';
/** Checked, locally hosted photos only. These illustrate subjects/places, never claim to document an event. */
export const STORY_PHOTOS: readonly StoryPhoto[] = [
  { id:'clayoquot', path:'/assets/stories/clayoquot.jpg', alt:'Forest-covered Vargas Island in Clayoquot Sound', credit:'Sam Beebe', sourceUrl:commons+'File:Clayoquot_Sound_-_Vargas_Island.jpg', licenseName:'CC BY 2.0', licenseUrl:'https://creativecommons.org/licenses/by/2.0/', kind:'place', caption:'Clayoquot Sound · Location photo, not the reported event' },
  { id:'klamath', path:'/assets/stories/klamath.jpg', alt:'The Upper Klamath River flowing through a wooded canyon', credit:'Bob Wick / BLM Oregon & Washington', sourceUrl:commons+'File:Klamath_River_-_28206035602.jpg', licenseName:'CC BY 2.0', licenseUrl:'https://creativecommons.org/licenses/by/2.0/', kind:'place', caption:'Klamath River · Location photo, not the reported event' },
  { id:'rover', path:'/assets/stories/rover.png', alt:'NASA Perseverance rover in a selfie on Mars', credit:'NASA/JPL-Caltech/MSSS', sourceUrl:commons+'File:Perseverance_Stuns_in_New_Selfie.png', licenseName:'Public domain', licenseUrl:commons+'File:Perseverance_Stuns_in_New_Selfie.png#Licensing', kind:'illustration', caption:'Perseverance · Illustrative photo, not this news event' },
  { id:'moon', path:'/assets/stories/moon.jpg', alt:'The Moon photographed by the Apollo 17 crew', credit:'NASA Johnson Space Center', sourceUrl:commons+'File:Full_disc_of_moon_photographed_by_Apollo_17_crewmen_during_transearth_coast_(as17-152-23311).jpg', licenseName:'Public domain', licenseUrl:commons+'File:Full_disc_of_moon_photographed_by_Apollo_17_crewmen_during_transearth_coast_(as17-152-23311).jpg#Licensing', kind:'illustration', caption:'Apollo 17 Moon photo · Illustrative, not this news event' },
  { id:'space', path:'/assets/stories/space.jpg', alt:'Sunrise over Earth photographed from the International Space Station', credit:'NASA/Jeff Williams', sourceUrl:commons+'File:ISS-47_Sunrise_on_our_Planet_Earth.jpg', licenseName:'Public domain', licenseUrl:commons+'File:ISS-47_Sunrise_on_our_Planet_Earth.jpg#Licensing', kind:'illustration', caption:'Earth from the ISS · Illustrative photo, not this news event' },
  { id:'forest', path:'/assets/stories/forest.jpg', alt:'Green rainforest in Costa Rica, used as a nature illustration', credit:'ImagePerson', sourceUrl:commons+'File:Costa_Rica_Rainforest_0017.jpg', licenseName:'CC BY-SA 4.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/', kind:'illustration', caption:'Nature illustration · Not the reported location or event' },
  {"id": "leopard-cat", "path": "/assets/stories/leopard-cat.jpg", "credit": "Mike Prince from Bangalore, India", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Leopard_Cat_(14839635578).jpg", "licenseName": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0/", "alt": "A wild leopard cat photographed in foliage", "kind": "illustration", "caption": "Leopard cat · Subject illustration, not this rescue"},
  {"id": "giraffe", "path": "/assets/stories/giraffe.jpg", "credit": "Giles Laurent", "sourceUrl": "https://commons.wikimedia.org/wiki/File:106_Angolan_giraffe_walking_in_the_Kalahari_Desert_of_Namibia_Photo_by_Giles_Laurent.jpg", "licenseName": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "alt": "An Angolan giraffe walking across grassland in Namibia", "kind": "illustration", "caption": "Angolan giraffe · Subject illustration photographed in Namibia"},
  {"id": "cattle", "path": "/assets/stories/cattle.jpg", "credit": "arboresce", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Nguni_Cows.jpg", "licenseName": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/", "alt": "A herd of Nguni cattle standing in a field", "kind": "illustration", "caption": "Nguni cattle · Subject illustration, not this reported herd"},
  {"id": "mangrove", "path": "/assets/stories/mangrove.jpg", "credit": "Jonathan Wilkins", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Detail_of_mangrove_roots.jpg", "licenseName": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/", "alt": "Red mangrove roots rising from the water at the edge of a mangrove forest", "kind": "illustration", "caption": "Mangrove roots · Subject illustration photographed in Brazil"},
  {"id": "reef-fish", "path": "/assets/stories/reef-fish.jpg", "credit": "Dr. Dwayne Meadows, NOAA/NMFS/OPR", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chaetodon_vagabundus.jpg", "licenseName": "Public domain", "licenseUrl": "https://commons.wikimedia.org/wiki/File:Chaetodon_vagabundus.jpg#Licensing", "alt": "A vagabond butterflyfish swimming above a coral reef", "kind": "illustration", "caption": "Vagabond butterflyfish · Subject illustration photographed in Micronesia"},
  {"id": "seabird", "path": "/assets/stories/seabird.jpg", "credit": "JJ Harrison", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Puffinus_griseus_in_flight_-_SE_Tasmania.jpg", "licenseName": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/", "alt": "A sooty shearwater flying low over the sea", "kind": "illustration", "caption": "Sooty shearwater · Subject illustration photographed off Tasmania"},
  {"id": "elephant", "path": "/assets/stories/elephant.jpg", "credit": "Gorgo", "sourceUrl": "https://commons.wikimedia.org/wiki/File:African_Bush_Elephants.jpg", "licenseName": "Public domain", "licenseUrl": "https://commons.wikimedia.org/wiki/File:African_Bush_Elephants.jpg#Licensing", "alt": "An African elephant and a calf standing on green grassland", "kind": "illustration", "caption": "African elephants · Subject illustration photographed in South Africa"},
];
/** `habitatPhotos` adds the subjects-v2 photos (mangrove, reef, seabird, elephant). It is requested only by the current page, so an older open page never meets an unfamiliar photo id. */
export function photoForStory(story: Pick<Story,'title'|'category'|'mapArea'>, subjectPhotos = true, habitatPhotos = false): StoryPhoto {
  const id = story.mapArea?.placeId === 'ca-clayoquot-sound' ? 'clayoquot' : story.mapArea?.placeId === 'us-klamath-river' ? 'klamath'
    : subjectPhotos && /\bleopard cats?\b/i.test(story.title) ? 'leopard-cat'
    : subjectPhotos && /\bgiraffes?\b/i.test(story.title) ? 'giraffe'
    // Farm animals only: "herd" alone also describes elephants or bison, and "sea cows" are manatees or dugongs.
    : subjectPhotos && /\b(?:livestock|cattle)\b|(?<!\bsea )\bcows?\b/i.test(story.title) ? 'cattle'
    : habitatPhotos && /\bmangroves?\b/i.test(story.title) ? 'mangrove'
    : habitatPhotos && /\b(?:seabirds?|albatross(?:es)?|shearwaters?|petrels?|puffins?)\b/i.test(story.title) ? 'seabird'
    // Species guard (General Counsel, October 24, 2026): the photo shows African savanna elephants, so a headline that names another kind gets the default art.
    : habitatPhotos && /\belephants?\b/i.test(story.title) && !/\b(?:asian|asiatic|indian|sri[- ]lankan|sumatran|born(?:e)?an|borneo|pygmy|forest)\s+elephants?\b/i.test(story.title) ? 'elephant'
    : habitatPhotos && /\b(?:coral|reefs?|seagrass|marine|ocean|deep[- ]sea)\b/i.test(story.title) ? 'reef-fish'
    : /\b(?:Perseverance|rovers?|Mars)\b/i.test(story.title) ? 'rover' : /\b(?:Moon|lunar)\b/i.test(story.title) ? 'moon'
    : story.category === 'Science' ? 'space' : 'forest';
  return STORY_PHOTOS.find(p=>p.id===id)!;
}
export function photoFields(photo: StoryPhoto) {
  return { image:photo.path, imageAlt:photo.alt, imageCredit:photo.credit, imageContext:photo.id };
}
export function storyPhoto(story: Pick<Story,'image'|'imageContext'>): StoryPhoto | undefined {
  return STORY_PHOTOS.find(p=>p.id===story.imageContext && p.path===story.image);
}
export function validStoryImage(story: Pick<Story,'image'|'imageAlt'|'imageCredit'|'imageContext'>): boolean {
  if (story.image === null) return story.imageCredit === null && story.imageContext === undefined && typeof story.imageAlt === 'string';
  const photo=storyPhoto(story);
  return !!photo && story.imageAlt === photo.alt && story.imageCredit === photo.credit;
}
