/**
 * Normalized entity contracts (JSDoc). UI must never bind to raw PDF text.
 * @module models/entities
 */

/**
 * @typedef {Object} Candidate
 * @property {string} id
 * @property {string} name
 * @property {string} officeId
 * @property {string} districtId
 * @property {string} cycleId
 * @property {string} [party]
 * @property {string} [normalizedName]
 */

/**
 * @typedef {Object} Report
 * @property {string} id
 * @property {string} candidateId
 * @property {string} sourceKey - Stable external key for dedupe (URL or filename hash)
 * @property {string} [sourceUrl]
 * @property {string} [fileName]
 * @property {string} cycleId
 * @property {string} officeId
 * @property {string} districtId
 * @property {string} [periodStart]
 * @property {string} [periodEnd]
 * @property {string} [filedDate]
 * @property {number} beginningBalance
 * @property {number} cashOnHand
 * @property {number} totalReceipts
 * @property {number} totalExpenditures
 * @property {number} totalLoans
 * @property {number} importedAt
 * @property {'parsed'|'partial'|'error'} status
 * @property {string} [errorMessage]
 */

/**
 * @typedef {Object} Contribution
 * @property {string} id
 * @property {string} reportId
 * @property {string} candidateId
 * @property {string} donorId
 * @property {string} donorName
 * @property {string} [donorType] - individual|pac|committee|organization|unknown
 * @property {boolean} [selfFunding] - true when donor matches the candidate (self-gift)
 * @property {number} amount
 * @property {string} [date]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 * @property {string} [county]
 * @property {string} [occupation]
 * @property {string} [employer]
 * @property {string} [schedule] - A|C|D
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} reportId
 * @property {string} candidateId
 * @property {string} vendorId
 * @property {string} vendorName
 * @property {number} amount
 * @property {string} [date]
 * @property {string} [purpose]
 * @property {string} [category]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 * @property {string} [schedule] - B
 */

/**
 * @typedef {Object} Vendor
 * @property {string} id
 * @property {string} name
 * @property {string} normalizedName
 * @property {string} [category]
 */

/**
 * @typedef {Object} Donor
 * @property {string} id
 * @property {string} name
 * @property {string} normalizedName
 * @property {string} [type]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 * @property {string} [occupation]
 */

/**
 * @typedef {Object} Pac
 * @property {string} id
 * @property {string} name
 * @property {string} normalizedName
 * @property {number} [confidence]
 */

/**
 * @typedef {Object} Committee
 * @property {string} id
 * @property {string} name
 * @property {string} normalizedName
 * @property {string} [type]
 */

/**
 * @typedef {Object} Organization
 * @property {string} id
 * @property {string} name
 * @property {string} normalizedName
 */

/**
 * @typedef {Object} ElectionCycle
 * @property {string} id
 * @property {string} label
 * @property {number} year
 */

/**
 * @typedef {Object} Office
 * @property {string} id
 * @property {string} label
 * @property {string} slug
 */

/**
 * @typedef {Object} District
 * @property {string} id
 * @property {string} officeId
 * @property {string} number
 * @property {string} label
 */

/**
 * @typedef {Object} Relationship
 * @property {string} id
 * @property {string} type - donation|payment|shared_donor|shared_vendor|shared_pac|shared_city
 * @property {string} fromId
 * @property {string} toId
 * @property {number} [amount]
 * @property {string} [date]
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} ParsedReportJSON
 * @property {Object} candidate
 * @property {string} candidate.name
 * @property {string} [candidate.office]
 * @property {string} [candidate.district]
 * @property {string} [candidate.party]
 * @property {string} [candidate.cycle]
 * @property {Object} summary
 * @property {number} [summary.beginningBalance]
 * @property {number} [summary.cashOnHand]
 * @property {number} [summary.totalReceipts]
 * @property {number} [summary.totalExpenditures]
 * @property {number} [summary.totalLoans]
 * @property {string} [summary.periodStart]
 * @property {string} [summary.periodEnd]
 * @property {string} [summary.filedDate]
 * @property {Array<Object>} contributions
 * @property {Array<Object>} expenses
 * @property {Array<Object>} [loans]
 * @property {string[]} [warnings]
 */

export const ENTITY_STORES = [
  'candidates',
  'reports',
  'contributions',
  'expenses',
  'vendors',
  'donors',
  'pacs',
  'committees',
  'organizations',
  'cycles',
  'offices',
  'districts',
  'relationships',
  'pdfBlobs',
  'settings',
  'meta',
];
