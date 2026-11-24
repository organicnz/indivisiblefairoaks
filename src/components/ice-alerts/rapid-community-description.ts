import type { RapidAlertKind } from './rapid-types';

type CommunityDescriptionInput = {
  /** Raw source comments. Never returned or copied into the output. */
  comments: string;
  /** Raw report location, used only to choose a fixed place category. */
  location?: string;
  kind: RapidAlertKind;
};

const VEHICLE_PLURAL =
  /\b(?:vehicles|trucks|suvs|vans|cars|sedans|convoys|units|pickups|veh[ií]culos|carros|coches)\b/;
const COLORED_VEHICLE =
  /\b(?:black|white|grey|gray|silver|blue|red|dark|unmarked|marked)\s+(?:ford|chevy|chevrolet|dodge|nissan|toyota|honda|suv|van|truck|car|pickup|explorer|tahoe|pathfinder|durango|charger|jeep|blazer|escape|edge|caravan|suburban|expedition|silverado)\b/;
const ICE_VEHICLE =
  /\b(?:ice|police|agent|patrol|unmarked|marked)\s+(?:vehicles?|trucks?|suvs?|vans?|cars?|units?|pickups?)\b|\b(?:vehicles?|trucks?|suvs?|vans?|cars?|units?|pickups?)\b[^.]{0,30}\b(?:plate|license plate|unmarked|masked)\b|\b(?:plate|license plate)\b[^.]{0,30}\b(?:vehicle|truck|suv|van|car|unit|pickup)\b/;
const MULTIPLE_VEHICLES =
  /\b(?:multiple|several|two|three|four|five|six|seven|eight|nine|ten|[2-9]|\d{2,})\s+(?:ice\s+|unmarked\s+|marked\s+)?(?:vehicles?|trucks?|suvs?|vans?|cars?|sedans?|units?|pickups?)\b/;
const AGENT = /\b(?:agents?|officers?|ero|fwc)\b/;
const ICE = /\b(?:ice|immigration enforcement)\b/;
const LAW_ENFORCEMENT = /\b(?:law enforcement|police|sheriff|homeland security|dhs)\b/;
const DETENTION_FACILITY =
  /\b(?:jail|prison|detention center|detention facility|processing center|holding facility|twin towers|mdc|irc)\b/;
const GOVERNMENT =
  /\b(?:courthouse|court house|city hall|uscis|asc office|field office|sheriff(?:'s)? (?:office|station|department)|police (?:department|station)|government|federal building|military|base|usda|social security|superior court)\b/;
const WORKPLACE =
  /\b(?:warehouse|business|store|shop|workplace|work site|job site|construction (?:site|zone)|restaurant|factory|plant|supermarket|grocery|costco|kroger|food 4 less|taqueria|nursery|parcel|shipping|pharmacy)\b/;
const HOTEL = /\b(?:home2\s*suites|home2suites|hotel|motel|inn|suites)\b/;
const SCHOOL = /\b(?:school|preschool|daycare|college|university|campus)\b/;
const WORSHIP = /\b(?:church|mosque|synagogue|temple)\b/;
const MEDICAL = /\b(?:hospital|clinic|medical center|urgent care)\b/;
const COURTHOUSE = /\b(?:courthouse|court house|superior court)\b/;
const RESIDENCE =
  /\b(?:apartment|home|house|residence|residential|neighborhood|private property|driveway|mobile home)\b/;
const AIRPORT = /\b(?:airport|terminal|departures)\b/;
const PARK = /\b(?:park|plaza|square|trail|beach)\b/;
const PUBLIC =
  /\b(?:street|avenue|ave|road|rd|boulevard|blvd|drive|lane|highway|freeway|interstate|intersection|corner|parking lot|park|sidewalk|downtown|blocks|trail|pike|route|us \d+|i-\d+|\d{1,3}(?:st|nd|rd|th))\b/;
const CHECKPOINT = /\b(?:checkpoint|roadblock|sobriety|dui)\b/;
const TRAFFIC_STOP =
  /\b(?:(?:pulled|pulling)\s+over|traffic\s+stop|stopped\s+(?:a\s+|the\s+)?(?:driver|vehicle|car|truck|taxi|van|pickup)|stopping\s+(?:cars|vehicles|drivers|traffic)|stopped\s+traffic|checkpoint|roadblock)\b/;
const TRAFFIC_INCIDENT =
  /\b(?:ran|run|running)\s+(?:a\s+)?red\s?light\b|\bblew\s+through\s+(?:a\s+)?red\s?light\b/;
const CHASE = /\b(?:chas(?:e|ed|ing)|pursu(?:ed|ing|it))\b/;
const CIRCLING = /\b(?:circl(?:e|ed|ing)|loop(?:ed|ing))\b/;
const FOLLOW =
  /\b(?:follow(?:ed|ing|s)?|tail(?:ed|ing)|surveill(?:ed|ing|ance)|track(?:ed|ing)|boxed in|converged on)\b/;
const RAID =
  /\b(?:raid(?:ed|s)?|smashed|busted|broke(?:n)?\s+(?:a\s+|the\s+)?(?:window|door|gate|lock)|ran\s+onto|entered|went\s+to\s+(?:his|her|their|a|the)\s+(?:home|house|apartment|residence))\b/;
const COMMUNITY_RESPONSE =
  /\b(?:community members?|observers?|bystanders?|residents?|neighbors?|protesters?|demonstrators?)\b[^.]{0,120}\b(?:arrived|showed up|responded|rallied|gathered|stayed|watched|documented|escorted|intervened|stood|formed|supported|standing|present|on scene|on the ground|working|helping|assisting)\b/;
const SUPPORT_REQUESTED =
  /\b(?:community support|support (?:is )?(?:requested|needed)|request(?:ed|ing)? (?:community )?support|need(?:ed)? (?:help|support|people)|community backup|backup (?:requested|needed)|rapid response|show up)\b/;
const OBSERVER =
  /\b(?:observers?|legal observers?|journalists?|press|filming|recording|documenting)\b/;
const CONFRONTATION =
  /\b(?:assault(?:ed|ing|s)?|attack(?:ed|ing)?|shov(?:ed|ing)|push(?:ed|ing)|grabb(?:ed|ing)|tackl(?:ed|ing)|threaten(?:ed|ing)|harass(?:ed|ing)|intimidat(?:ed|ing))\b/;
const NO_CUSTODY =
  /\b(?:no one|nobody|none)\s+(?:was|were)?\s*(?:taken|detained|arrested|in custody)\b|\bno (?:arrests?|detentions?)\b/;
const CUSTODY =
  /\b(?:arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|handcuff(?:ed|s|ing)?|apprehend(?:ed|s)?|kidnap(?:ped|ping|s)?|abduct(?:ed|ing|s)?|taken into custody)\b|\b(?:man|woman|person|driver|worker|people|someone|somebody|everyone|individual|citizen|teen|youth|lad|him|her|them)\b[^.]{0,60}\b(?:taken|took|detained|arrested|kidnapped|abducted)\b|\b(?:taken|took)\b[^.]{0,60}\b(?:man|woman|person|driver|worker|people|someone|somebody|everyone|individual|citizen|teen|youth|lad|him|her|them)\b|\b(?:fue|fueron|se)\s+(?:secuestrad[oa]s?|detenid[oa]s?|arrestad[oa]s?|llevad[oa]s?)\b/;
const LEFT =
  /\b(?:agents?|vehicles?|units?|officers?|they|ice)\b[^.]{0,40}\b(?:left|leaving|leave|departed|drove away|drive away|retreat(?:ed|s)?|cleared out|packed up)\b|\b(?:left|departed|drove away|cleared out|packed up)\b[^.]{0,30}\b(?:area|scene|location|street|neighborhood|there|property)\b/;
const NOT_LEFT =
  /\b(?:have|has|had|did|does|do)\s+not\s+(?:left|departed)|didn't leave|not yet left|still (?:there|present|parked|in the area|on scene)\b/;
const MASKED = /\b(?:masked|face covering|plain ?clothes|plainclothes|unmarked)\b/;
const NO_PLATES = /\b(?:no|without)\s+(?:license\s+)?plates?\b|\bplateless\b/;
const CAMERA_CREW = /\b(?:camera crew|videographer|photographer)\b/;
const PROPERTY_DAMAGE =
  /\b(?:smashed|busted|broke(?:n)?)\b[^.]{0,40}\b(?:window|windshield|door|gate|lock)\b/;
const TRAFFIC_HAZARD =
  /\b(?:car|vehicle|truck|suv|pickup)\b[^.]{0,40}\b(?:flipped|overturned|rolled over|crashed)\b|\b(?:flipped|overturned|rolled over)\b[^.]{0,20}\b(?:car|vehicle|truck|suv|pickup)\b/;
const MULTIPLE_PEOPLE =
  /\b(?:multiple|several|two|three|four|five|six|seven|eight|nine|ten|[2-9]|\d{2,})\s+(?:people|persons|individuals|drivers|workers|men|women)\b|\b(?:everyone|individuals|persons|personas|conductores|trabajadores)\b/;

function normalizedComments(value: string) {
  return value
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4_000)
    .toLowerCase();
}

function plateCount(text: string) {
  return (text.match(/\b(?:license\s+)?plates?\b/g) ?? []).length;
}

function hasMultipleVehicles(text: string) {
  return MULTIPLE_VEHICLES.test(text) || VEHICLE_PLURAL.test(text) || plateCount(text) >= 2;
}

function placeLabel(text: string) {
  if (DETENTION_FACILITY.test(text)) return ' near a jail or detention facility';
  if (COURTHOUSE.test(text)) return ' near a courthouse';
  if (GOVERNMENT.test(text)) return ' near a government or court building';
  if (AIRPORT.test(text)) return ' at an airport';
  if (PARK.test(text)) return ' near a public park or outdoor area';
  if (WORKPLACE.test(text)) return ' at or near a business or workplace';
  if (HOTEL.test(text)) return ' at a hotel';
  if (SCHOOL.test(text)) return ' near a school or campus';
  if (MEDICAL.test(text)) return ' near a medical facility';
  if (WORSHIP.test(text)) return ' near a place of worship';
  if (RESIDENCE.test(text)) return ' near a residence or residential area';
  if (PUBLIC.test(text)) return ' on a public street or in a public area';
  return ' in the area';
}

function primarySentence(text: string, kind: RapidAlertKind, location?: string): string {
  const commentPlace = placeLabel(text);
  const place =
    commentPlace === ' in the area' && location
      ? placeLabel(normalizedComments(location))
      : commentPlace;
  if (kind === 'checkpoint' || CHECKPOINT.test(text)) {
    return `Reporters described a checkpoint or roadblock${place}.`;
  }
  if (CHASE.test(text)) {
    return `Reporters described agents chasing a person or vehicle${place}.`;
  }
  if (CIRCLING.test(text)) {
    return `Reporters described an ICE vehicle circling${place}.`;
  }
  if (FOLLOW.test(text)) {
    return `Reporters described agents following or surrounding someone${place}.`;
  }
  if (TRAFFIC_STOP.test(text)) {
    return `Reporters described officers stopping vehicles${place}.`;
  }
  if (TRAFFIC_INCIDENT.test(text)) {
    return `Reporters described a vehicle running a red light${place}.`;
  }
  if (RAID.test(text)) {
    return `Reporters described a raid or entry${place}.`;
  }
  if (DETENTION_FACILITY.test(text)) {
    if (hasMultipleVehicles(text)) {
      return 'Reporters described multiple ICE vehicles near a jail or detention facility.';
    }
    return `Reporters described ${
      kind === 'detention' ? 'detention activity' : 'ICE agents'
    } near a jail or detention facility.`;
  }
  if (kind === 'detention') {
    return `Reporters described detention activity${place}.`;
  }
  if (hasMultipleVehicles(text)) {
    return `Reporters described multiple ICE vehicles${place}.`;
  }
  if (AGENT.test(text)) {
    return `Reporters described ICE agents${place}.`;
  }
  if (ICE.test(text)) {
    return `Reporters described ICE activity${place}.`;
  }
  if (ICE_VEHICLE.test(text) || COLORED_VEHICLE.test(text)) {
    return `A vehicle was reported${place}.`;
  }
  if (LAW_ENFORCEMENT.test(text)) {
    return `Reporters described a law enforcement presence${place}.`;
  }
  if (CUSTODY.test(text) && place !== ' in the area') {
    return `Reporters described a detention${place}.`;
  }
  return `Reporters described a community sighting of enforcement activity${place}.`;
}

function responseSentence(text: string) {
  if (CONFRONTATION.test(text) && OBSERVER.test(text)) {
    return SUPPORT_REQUESTED.test(text)
      ? 'Agents were described confronting or assaulting observers, and community support was requested.'
      : 'Agents were described confronting or assaulting observers.';
  }
  if (COMMUNITY_RESPONSE.test(text)) {
    return 'Community members or observers responded.';
  }
  if (SUPPORT_REQUESTED.test(text)) {
    return 'Community support was requested.';
  }
  return null;
}

function detailSentence(text: string, primary: string) {
  if (MASKED.test(text)) {
    return 'Masked agents or unmarked vehicles were reported.';
  }
  if (NO_PLATES.test(text)) {
    return 'Vehicles without plates were reported.';
  }
  if (CAMERA_CREW.test(text)) {
    return 'A camera crew was reportedly with the agents.';
  }
  if (PROPERTY_DAMAGE.test(text)) {
    return 'A vehicle window was reportedly broken.';
  }
  if (TRAFFIC_HAZARD.test(text)) {
    return 'A vehicle reportedly overturned.';
  }
  if (!primary.includes('vehicle') && (ICE_VEHICLE.test(text) || COLORED_VEHICLE.test(text))) {
    return ICE.test(text) ? 'An ICE vehicle was also reported.' : 'A vehicle was also reported.';
  }
  if (!primary.includes('multiple ICE vehicles') && hasMultipleVehicles(text)) {
    return 'Multiple ICE vehicles were reported.';
  }
  return null;
}

function custodySubject(text: string) {
  if (MULTIPLE_PEOPLE.test(text)) return { phrase: 'multiple people', plural: true };
  if (/\bat least (?:one|1)\b/.test(text)) {
    return { phrase: 'at least one person', plural: false };
  }
  if (/\bconstruction worker\b/.test(text)) {
    return { phrase: 'a construction worker', plural: false };
  }
  if (/\b(?:worker|employee)\b/.test(text)) return { phrase: 'a worker', plural: false };
  if (/\b(?:taxi driver|driver)\b/.test(text)) return { phrase: 'a driver', plural: false };
  if (/\bpedestrian\b/.test(text)) return { phrase: 'a pedestrian', plural: false };
  if (/\b(?:student|pupil)\b/.test(text)) return { phrase: 'a student', plural: false };
  if (/\b(?:resident|neighbor)\b/.test(text)) {
    return { phrase: 'a resident', plural: false };
  }
  if (/\bpassenger\b/.test(text)) return { phrase: 'a passenger', plural: false };
  if (/\bconductor\b/.test(text)) return { phrase: 'a driver', plural: false };
  if (/\btrabajador\b/.test(text)) return { phrase: 'a worker', plural: false };
  if (/\b(?:persona|mujer|hombre)\b/.test(text)) return { phrase: 'a person', plural: false };
  if (/\b(?:man|woman|person|someone|somebody|citizen|teen|youth|lad|him|her|them)\b/.test(text)) {
    return { phrase: 'a person', plural: false };
  }
  return { phrase: 'at least one person', plural: false };
}

function outcomeSentence(text: string) {
  const noCustody = NO_CUSTODY.test(text);
  const left = LEFT.test(text) && !NOT_LEFT.test(text);
  if (noCustody) {
    return left
      ? 'No one was reported taken into custody, and the reported agents later left the area.'
      : 'No one was reported taken into custody.';
  }
  if (CUSTODY.test(text)) {
    const subject = custodySubject(text);
    return `Reporters said ${subject.phrase} ${
      subject.plural ? 'were' : 'was'
    } taken into custody.`;
  }
  return left ? 'The reported agents or vehicles later left the area.' : null;
}

/**
 * Build a short public description from the fetched report text. The output is
 * assembled only from fixed, generalized sentences and place categories, so a
 * name, street address, plate, phone number, or unique personal detail in the
 * source cannot reach the browser.
 */
export function communityDescription({
  comments,
  location,
  kind,
}: CommunityDescriptionInput): string {
  const text = normalizedComments(comments);
  const primary = primarySentence(text, kind, location);
  const parts = [
    primary,
    responseSentence(text),
    outcomeSentence(text),
    detailSentence(text, primary),
  ].filter((part): part is string => Boolean(part));

  return parts.slice(0, 3).join(' ');
}
