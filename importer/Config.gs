/**
 * LogiSys Importer — plumbing, not an agent.
 * Philindo Container Express Inc.
 *
 * Reads the daily LogiSys register emails (SEA and AIR), parses the
 * attachments and writes exactly two sheets, both of which it creates
 * and owns:
 *   - LogiSys Live     one row per JO, current state, latest report wins
 *   - LogiSys Archive  append-only history of every change, never edited
 *
 * It never writes to the CA Tracker, Billing Tracker, Manifest Control or
 * any other Philindo sheet or web app. It never emails staff — only the COO,
 * and only when something failed.
 *
 * This is its own Apps Script project, separate from Penny, so a parsing
 * bug here can never make Penny send a wrong email.
 */

const IMPORTER = {
  TZ: 'Asia/Manila',

  // The workbook holding LogiSys Live + Archive — the SAME workbook Penny
  // reads. Required: this project is standalone, not bound to that sheet.
  FEED_SPREADSHEET_ID: '',                     // FILL IN
  SHEET_LIVE: 'LogiSys Live',
  SHEET_ARCHIVE: 'LogiSys Archive',

  // ---- The LogiSys email --------------------------------------------------
  // LogiSys sends the report to this inbox every day at 06:00. Gmail is read
  // as the account that installs this project, so install it signed in as
  // this address — the importer checks and tells the COO if it is not.
  INBOX: 'franchisekid43@gmail.com',
  // Matched on sender (when set) and subject, never on position in the inbox.
  // Blank = subject only. Fill in from the first real LogiSys email.
  FEED_SENDER: '',
  FEED_SUBJECTS: ['SEA Shipment Register', 'AIR Shipment Report'],   // matched loosely
  SEARCH_DAYS: 7,                              // how far back to look for unprocessed reports
  LABEL_DONE: 'LogiSys/Imported',              // for people; processing is tracked by message id
  LABEL_FAILED: 'LogiSys/Failed',
  HEADER_SEARCH_ROWS: 10,                      // LogiSys puts ~3 preamble lines above the header

  // ---- Schedule -----------------------------------------------------------
  // Every 15 minutes: the 06:00 report is in LogiSys Live by ~06:15, well
  // before Penny runs at 07:45.
  TRIGGER_EVERY_MINUTES: 15,
  // If no report dated today has been imported by this time on a working
  // day, tell the COO — once.
  MISSING_ALERT_HOUR: 7,
  MISSING_ALERT_MINUTE: 30,

  // ---- Failures go here, and only here -------------------------------------
  COO: 'transport@philindo.com.ph',

  // ---- Date sanity ----------------------------------------------------------
  DATE_MIN: new Date(2024, 0, 1),
  DATE_MAX: new Date(2027, 11, 31),

  // Same list as Penny's CONFIG.STATUS_DELIVERED. Confirmed by the COO
  // 28 Sep 2026: "Container Delivery Date" and "Delivery Advised to Client"
  // both mean delivered.
  STATUS_DELIVERED: [
    'job completed',
    'empty container received after delivery',
    'container delivery date',
    'delivery advised to client'
  ],
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
  }
};

// The LogiSys Live contract. Penny, Nico and the Command Center depend on
// these exact header strings. Must match Penny's FEED_HEADERS (the test
// suite checks it).
// 'Delivered' = the report date on which the JO was FIRST reported with a
// delivered status. LogiSys carries no delivery date; this is the earliest
// date the feed can evidence, never a guess.
// 'Last Updated' = the report date on which the Status last changed.
const FEED_HEADERS = [
  'JO Number','FSA Number','BL/AWB','House BL/AWB','Shipper','Client',
  'Mode','Cargo Type','Loading Port','Discharge Port','Place Of Receipt',
  'Place Of Delivery','Shipment Date','ETD','ATD','ETA','ATA',
  'Containers 20ft','Containers 40ft','Containers 45ft','Container Nos',
  'Total Packages','Unit','Goods Description','Airline','Flight No',
  'Status','Stage','Delivered','Account Handler','Last Updated','Source Report Date'
];

const DATE_FIELDS = ['Shipment Date','ETD','ATD','ETA','ATA'];
const NUMBER_FIELDS = ['Containers 20ft','Containers 40ft','Containers 45ft','Total Packages'];

// How each LogiSys register's columns map onto the schema above. Header
// text is matched exactly as LogiSys writes it — note that the FSA column
// is spelled differently in the two reports.
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
  'Good Desc':'Goods Description', 'Status':'Status',
  'Account Handler':'Account Handler'          // only if LogiSys ever adds it
};
const AIR_MAP = {
  'Shipment No':'JO Number', 'FSANumber (UDF)':'FSA Number', 'AWB NO':'BL/AWB',
  'HAWB No':'House BL/AWB', 'Shipper':'Shipper', 'Consignee':'Client',
  'Airline':'Airline', 'Flight No':'Flight No', 'Loading Port':'Loading Port',
  'Discharge Port':'Discharge Port', 'Place Of Delivery':'Place Of Delivery',
  'Shipment Date':'Shipment Date', 'ETD':'ETD', 'ATD':'ATD',
  'ETA':'ETA', 'ATA':'ATA', 'Total Packages':'Total Packages', 'Unit':'Unit',
  'Good Desc':'Goods Description', 'Status':'Status',
  'Account Handler':'Account Handler'
};

// A register missing any of these is rejected whole: nothing is written.
const REQUIRED_SOURCE = ['Shipment No','Consignee','ETD','ETA','ATA','Status'];
