/**
 * PENNY — Pending Shipments Agent
 * Philindo Container Express Inc.
 *
 * Owns ATA -> delivered. Nico owns delivered -> billed.
 * The delivery date is the handoff.
 *
 * READ-ONLY against every existing Philindo sheet.
 * Penny's ONLY writes are to sheets she creates herself:
 *   - LogiSys Live      (mirror, written by the importer; Penny reads only)
 *   - Penny Arrivals    (her own summary)
 *   - Penny Monthly     (her own generated report)
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

  // ---- Feed intake (the importer) --------------------------------------
  FEED_SENDER: 'no-reply@philindo.com.ph',
  FEED_SUBJECT_SEA: 'SEA Shipment Register',     // matched loosely
  FEED_SUBJECT_AIR: 'AIR Shipment Report',
  FEED_LABEL_DONE: 'LogiSys/Imported',
  FEED_HEADER_ROW: 4,          // LogiSys puts 3 preamble lines above the header

  // ---- Scope cutoff ----------------------------------------------------
  // LogiSys is not updated as reliably as the CA Tracker. Anything anchored
  // before this date is treated as already delivered and is out of scope,
  // whatever its status says. COO's rule, 28 Sep 2026.
  SCOPE_FROM: new Date(2026, 8, 1),   // 1 September 2026

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
  Q1_AMBER: 2,               // arrived, not delivered
  Q1_RED: 4,                 // 2 days before storage charges begin
  Q1_CRITICAL: 6,            // storage running, demurrage 2 days out

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

  // ---- Total ATA -> delivered ------------------------------------------
  TOTAL_AMBER: 5,
  TOTAL_RED: 8,

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
  // Used only to spot an arrival that the ATA column never recorded
  STATUS_IMPLIES_ARRIVAL: ['reached','discharged','do issued','gatepass',
                           'lodgement','checking of documents','duties']
};

// LogiSys Live schema contract. The importer writes these exact headers.
// LogiSys Live schema. Written by the importer, normalised from the two
// LogiSys register exports (SEA and AIR), whose own columns differ.
const FEED_HEADERS = [
  'JO Number','FSA Number','BL/AWB','House BL/AWB','Shipper','Client',
  'Mode','Cargo Type','Loading Port','Discharge Port','Place Of Receipt',
  'Place Of Delivery','Shipment Date','ETD','ATD','ETA','ATA',
  'Containers 20ft','Containers 40ft','Containers 45ft','Container Nos',
  'Total Packages','Unit','Goods Description','Airline','Flight No',
  'Status','Stage','Delivered','Account Handler','Last Updated','Source Report Date'
];

// How each LogiSys register's columns map onto the schema above.
// Header text is matched exactly as LogiSys writes it — note that the FSA
// column is spelled differently in the two reports.
const SEA_MAP = {
  'Shipment No':'JO Number', 'FSA Number (UDF)':'FSA Number', 'BL NO':'BL/AWB',
  'HBL No':'House BL/AWB', 'Shipper':'Shipper', 'Consignee':'Client',
  'Cargo Type':'Cargo Type', 'Loading Port':'Loading Port',
  'Discharge Port':'Discharge Port', 'Place Of Receipt':'Place Of Receipt',
  'Place Of Delivery':'Place Of Delivery', 'Shipment Date':'Shipment Date',
  'ETD':'ETD', 'ATD':'ATD', 'ETA':'ETA', 'ATA':'ATA',
  '20 Feet Containers':'Containers 20ft', '40 Feet Containers':'Containers 40ft',
  '45 Feet Containers':'Containers 45ft', 'Container Nos.':'Container Nos',
  'Total Packages':'Total Packages', 'Unit':'Unit',
  'Good Desc':'Goods Description', 'Status':'Status'
};
const AIR_MAP = {
  'Shipment No':'JO Number', 'FSANumber (UDF)':'FSA Number', 'AWB NO':'BL/AWB',
  'HAWB No':'House BL/AWB', 'Shipper':'Shipper', 'Consignee':'Client',
  'Airline':'Airline', 'Flight No':'Flight No', 'Loading Port':'Loading Port',
  'Discharge Port':'Discharge Port', 'Place Of Delivery':'Place Of Delivery',
  'Shipment Date':'Shipment Date', 'ETD':'ETD', 'ATD':'ATD',
  'ETA':'ETA', 'ATA':'ATA', 'Total Packages':'Total Packages', 'Unit':'Unit',
  'Good Desc':'Goods Description', 'Status':'Status'
};
