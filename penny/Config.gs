/**
 * PENNY — Pending Shipments Agent
 * Philindo Container Express Inc.
 *
 * Owns ATA -> delivered. Nico owns delivered -> billed.
 * The delivery date is the handoff.
 *
 * READ-ONLY against every existing Philindo sheet.
 * Penny's ONLY writes are to sheets she creates herself:
 *   - Penny Arrivals    (her own summary)
 *   - Penny Monthly     (her own generated report)
 * LogiSys Live and LogiSys Archive are written by the importer; Penny
 * only reads them.
 * She never touches the CA Tracker, Billing Tracker, Manifest Control,
 * or any Philindo web app.
 */

const CONFIG = {

  // ---- Identity -------------------------------------------------------
  AGENT: 'Penny',

  // ---- Schedule -------------------------------------------------------
  SEND_HOUR: 7,
  SEND_MINUTE: 45,            // Penny 07:45, Nico 08:00
  MONTHLY_REPORT_DAY: 7,      // arrivals report generated on the 7th
  TZ: 'Asia/Manila',

  // Feed intake (sender, subjects, label, column maps) lives in the
  // importer's own project — see importer/Importer.gs. Penny only reads.

  // ---- Scope cutoff ----------------------------------------------------
  // LogiSys is not updated as reliably as the CA Tracker. Anything anchored
  // before this date is treated as already delivered and is out of scope,
  // whatever its status says. COO's rule, 28 Sep 2026.
  SCOPE_FROM: new Date(2026, 8, 1),   // 1 September 2026

  // ---- Arrival source — ONE switch -------------------------------------
  // LogiSys writes its ETA into the ATA field, so while Ariel maintains the
  // tracker separately the LogiSys ATA is not trusted on its own
  // (28 Sep 2026: 33 of 87 arrival dates disagreed, all one direction).
  //   false -> arrival = post-arrival status milestone, then the LogiSys ATA
  //            only where it differs from that row's own ETA
  //   true  -> arrival = the LogiSys ATA as written
  // Flip to true once Ariel updates LogiSys directly. Nothing else changes.
  TRUST_LOGISYS_ATA: false,

  // ---- Spreadsheets ---------------------------------------------------
  // The workbook holding LogiSys Live + LogiSys Archive (written by importer).
  // Leave blank to use the spreadsheet this script is bound to.
  FEED_SPREADSHEET_ID: '',
  SHEET_LIVE: 'LogiSys Live',
  SHEET_ARCHIVE: 'LogiSys Archive',

  // Penny's own output sheets (she creates these)
  SHEET_ARRIVALS: 'Penny Arrivals',
  SHEET_MONTHLY_PREFIX: 'Penny Monthly',

  // CA Tracker — READ ONLY
  CA_TRACKER_ID: '1YGG27KbsZUalEI-UekGk4nUnq3yttMM9w6kGo1-gSc8',
  CA_TAB: 'CA Tracker',
  CA_HEADER_ROW: 2,

  // ---- Recipients -----------------------------------------------------
  // Deliberately absent: Juan Carlos Uy (post-delivery = Nico's),
  // the billing team, the CFO and the President. Do not add them.
  RECIPIENTS: {
    coo: 'transport@philindo.com.ph',
    support: 'arielcaingcoy@philindo.com.ph',   // Ariel Caingcoy
    handlers: {
      'Kim Angelu Kong': 'kimkong@philindo.com.ph',
      'Jena Lucido': 'jenalucido@philindo.com.ph',
      'Cherry Alarcon': 'cherryalarcon@philindo.com.ph',
      'Jimmy Rapera': 'jimmyrapera@philindo.com.ph',
      'Andrew Mausig': '',             // FILL IN — copy from Nico
      'Jasmin Sawal': ''               // FILL IN — copy from Nico
    }
  },

  // ---- Free time (Philindo actual terms) ------------------------------
  STORAGE_FREE_DAYS: 5,      // port storage MAX free -> charges from day 6
  DEMURRAGE_FREE_DAYS: 7,    // line container MIN free -> charges from day 8

  // ---- Thresholds (calendar days) -------------------------------------
  // Queue 1 red and critical are NOT set here — they are derived from the
  // free time above by q1Thresholds_(): critical = first charge day,
  // red = RED_LEAD_DAYS before it. Change a free period and they move.
  Q1_AMBER: 2,               // arrived, not delivered
  RED_LEAD_DAYS: 2,          // red always sits this many days before the first charge

  Q2_ETA_WINDOW: 3,          // in transit, arriving within N days

  Q4_STALE_RED: 8,           // status not moved in 8+ days

  Q5A_AMBER_ETD_PAST: 1,     // no ETA, ETD passed 1-3 days
  Q5A_RED_ETD_PAST: 4,       // no ETA, ETD passed 4+ days
  Q5B_AMBER_LATER: 2,        // ETA moved 2-4 days later
  Q5B_RED_LATER: 5,          // ETA moved 5+ days later
  Q5B_RED_EARLIER: 2,        // ETA moved 2+ days EARLIER = red, always
  Q5C_AMBER: 1,              // ETA passed, no ATA
  Q5C_RED: 3,

  // ---- Client lead-time overrides (win over general thresholds) --------
  CLIENT_SLA: {
    'UNILAB': { Air: 3, Sea: 4 },      // air under 72h, sea under 4 days
    'DEFAULT': { Air: 4, Sea: 4 }
  },
  UNILAB_PHARMA_SLA_WORKING_DAYS: 7,

  // Unilab Indonesia pharma lane: Unilab + a loading port matching this
  UNILAB_PHARMA_PORTS: ['indonesia','jakarta','tanjung priok','surabaya','semarang','belawan','idjkt','idsub'],

  // ---- Date sanity -----------------------------------------------------
  DATE_MIN: new Date(2024, 0, 1),
  DATE_MAX: new Date(2027, 11, 31),

  // ---- Handlers on record ----------------------------------------------
  HANDLERS: ['Kim Angelu Kong','Jena Lucido','Cherry Alarcon',
             'Jimmy Rapera','Andrew Mausig','Jasmin Sawal'],

  // ---- Cash advance funding -------------------------------------------
  // CA Tracker "Release Status" is about MONEY leaving the company, not
  // about the shipment leaving the port. Three states matter:
  //   Released            -> funded
  //   Partially Released  -> partial. Shipments CAN be delivered on a
  //                          partial release, so this is not an alarm.
  //   Not Released        -> unfunded. This is the one to flag.

  // ---- Status ladder (real LogiSys milestone values) --------------------
  // There is NO Delivery Date column in the LogiSys feed, so delivery is
  // determined by status. Confirmed by the COO 28 Sep 2026: "Container
  // Delivery Date" and "Delivery Advised to Client" both mean delivered.
  STATUS_DELIVERED: [
    'job completed',
    'empty container received after delivery',
    'container delivery date',
    'delivery advised to client'
  ],
  // Everything else, roughly in order, for reporting the stage:
  STATUS_STAGES: {
    'vessel one departed': 'In transit',
    'flight one departed': 'In transit',
    'vessel one reached': 'Arrived',
    'container discharged': 'Arrived',
    'draft documents received': 'Clearing',
    'original docs received': 'Clearing',
    'checking of documents': 'Clearing',
    'lodgement of shipment': 'Clearing',
    'cdt approval': 'Clearing',
    'payment of duties and taxes': 'Clearing',
    'do issued': 'Released',
    'gatepass released': 'Released'
  },
  // Milestones that only happen AFTER arrival. With TRUST_LOGISYS_ATA off,
  // these are what say a shipment has arrived. ("Vessel One Reached" is
  // deliberately absent: vessel one can be a transhipment leg.)
  STATUS_POST_ARRIVAL: ['container discharged','do issued','gatepass released',
                        'payment of duties and taxes','final assesment','final assessment'],
  // Used only to spot an arrival that the ATA column never recorded
  STATUS_IMPLIES_ARRIVAL: ['reached','discharged','do issued','gatepass',
                           'lodgement','checking of documents','duties'],

  // ---- Never contacted — checked before every send ---------------------
  NEVER_CONTACT: ['juan carlos','raphael ramos','billing','pablo franco',
                  'oliver osias','cfo','president']
};

// Headers Penny cannot run without. Delivery is read from 'Delivered',
// 'Delivery Date' (if present) or a delivered status, so neither is required.
const LIVE_REQUIRED = ['JO Number','Client','Mode','ETD','ETA','ATA','Status',
                       'Account Handler','Last Updated','Source Report Date'];

// LogiSys Live schema contract. The importer writes these exact headers,
// normalised from the two LogiSys register exports (SEA and AIR).
// 'Delivered' holds the report date on which the JO was FIRST reported with
// a delivered status (LogiSys carries no delivery date); blank otherwise.
const FEED_HEADERS = [
  'JO Number','FSA Number','BL/AWB','House BL/AWB','Shipper','Client',
  'Mode','Cargo Type','Loading Port','Discharge Port','Place Of Receipt',
  'Place Of Delivery','Shipment Date','ETD','ATD','ETA','ATA',
  'Containers 20ft','Containers 40ft','Containers 45ft','Container Nos',
  'Total Packages','Unit','Goods Description','Airline','Flight No',
  'Status','Stage','Delivered','Account Handler','Last Updated','Source Report Date'
];
