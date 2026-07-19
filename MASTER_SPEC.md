# CURSOR MASTER PROMPT
# Kansas Campaign Finance Explorer
# Part 1 - Project Vision, Architecture, Agent Assignments & Core Requirements

---

# ROLE

You are the Lead Software Architect and Engineering Manager for a large open-source software project.

Your first responsibility is NOT writing code.

Your first responsibility is organizing the work.

Treat this project like a real software company would.

Break the work into logical workstreams.

Automatically create and coordinate as many parallel AI coding agents as necessary.

Every agent should own one subsystem.

Every subsystem should have:

- clear ownership
- documented interfaces
- no overlapping responsibilities
- modular design
- unit tests
- documentation

Agents should work independently whenever possible.

Merge completed work back into the project continuously.

Resolve merge conflicts intelligently.

Do not duplicate code.

Refactor when appropriate.

Prioritize maintainability over shortcuts.

Always choose scalable architecture over quick implementations.

---

# PROJECT NAME

Kansas Campaign Finance Explorer

---

# PROJECT GOAL

Build the best open-source campaign finance analysis platform for Kansas.

This should become a civic transparency platform used by:

- Journalists
- Campaigns
- Citizens
- Political Parties
- Researchers
- Government Watchdogs
- Students

This is NOT simply a PDF viewer.

This is an analytics platform.

It should feel closer to:

Power BI

Tableau

ArcGIS Dashboards

than a traditional website.

---

# CORE PRINCIPLES

Everything must run entirely in the browser.

No backend.

No servers.

No authentication.

No accounts.

No cloud APIs.

No paid services.

No API keys.

Deploy entirely on GitHub Pages.

Everything should work offline after reports have been downloaded.

The application should be installable as a Progressive Web App (PWA).

---

# DEFAULT VIEW

When the application first loads:

Election Cycle

2026

Office

Kansas House

District

70

District 70 is ONLY the default filter.

The architecture must NEVER assume District 70.

The entire application must be designed around statewide data.

---

# STATEWIDE-FIRST ARCHITECTURE

This is a mandatory architectural requirement.

Design everything so that importing one report or ten thousand reports requires zero redesign.

Support:

Every Kansas House district

Every Kansas Senate district

Governor

Secretary of State

Attorney General

Treasurer

Insurance Commissioner

Judicial races

PACs

Party Committees

Multiple election cycles

Multiple filings

Multiple reports per candidate

The application should simply grow as reports are imported.

Nothing should require architectural changes.

District 70 is simply the initial filter.

---

# PRIMARY USER EXPERIENCE

Open website

↓

Automatically display District 70 dashboard

↓

User clicks

Refresh From Kansas

↓

Application downloads latest filing list

↓

Detects new reports

↓

Downloads only new PDFs

↓

Parses them

↓

Updates dashboards

↓

Everything becomes searchable immediately

---

# TECHNOLOGY STACK

Use:

HTML5

CSS3

Bootstrap 5

Vanilla JavaScript ES Modules

Chart.js

PDF.js

Fuse.js

Leaflet

D3.js

DataTables

PapaParse

IndexedDB

LocalStorage

Service Worker

PWA Manifest

No React

No Angular

No Vue

No server-side rendering

No backend language

No databases other than IndexedDB

---

# UI STYLE

Modern analytics dashboard

Dark mode by default

Accent colors:

Kansas Blue

White

Gray

Responsive

Desktop first

Tablet

Mobile

Animations should be subtle.

Performance should always take priority over flashy effects.

---

# PERFORMANCE GOALS

First load

< 2 seconds

Dashboard refresh

< 500 ms

Search

Instant

Relationship graph

Smooth with thousands of nodes

Charts

Render under one second

---

# PROJECT STRUCTURE

Organize code similarly to:

/assets

/css

/js

/components

/modules

/services

/models

/data

/tests

/docs

/vendor

README.md

LICENSE

CHANGELOG.md

---

# DATA MODEL

All imported data should be normalized.

Never build UI directly from PDFs.

Everything should be converted into structured objects.

Core entities include:

Candidate

Report

Contribution

Expense

Vendor

PAC

Committee

Individual Donor

Organization

Election Cycle

Office

District

City

ZIP

County

Occupation

Relationship

Every entity should receive a unique internal ID.

Relationships should be stored separately.

---

# IMPORT METHODS

Support BOTH:

Automatic Kansas importing

AND

Drag & Drop PDF importing

Users should never have to manually organize files.

---

# AUTOMATIC IMPORT

Automatically discover:

Election cycles

Office types

Candidates

Filing periods

PDF links

Detect new reports.

Download only reports that have not already been imported.

Cache downloaded reports.

Support manual refresh.

Support bulk import.

---

# PDF PARSING

Extract:

Candidate

Office

District

Election cycle

Reporting period

Cash on hand

Beginning balance

Receipts

Expenditures

Loans

Schedule A

Schedule B

Schedule C

Schedule D

Normalize everything.

Never expose raw PDF text to UI components.

---

# STORAGE

Use IndexedDB.

Cache:

PDFs

Parsed reports

Search indexes

Known PACs

Vendor categories

Settings

Themes

Application version

Support migrations.

---

# SEARCH

Global search should search:

Candidate

Donor

PAC

Committee

Vendor

Occupation

Purpose

City

ZIP

County

District

Election cycle

Search should feel instantaneous.

---

# ANALYTICS

Calculate:

Raised

Spent

Cash

Loans

Average Donation

Median Donation

Largest Donation

Repeat Donors

Repeat Vendors

PAC %

Individual %

Self Funding %

Top Vendors

Top Categories

Fundraising Timeline

Expense Timeline

Cash Growth

Comparison Metrics

Everything should update automatically after imports.

---

# VISUALIZATIONS

Use Chart.js and D3.

Support:

Bar charts

Pie charts

Treemaps

Heatmaps

Network graphs

Sankey diagrams

Timelines

Maps

Every chart should export to PNG.

---

# MAPS

Use Leaflet.

Display Kansas legislative districts.

Color by:

Raised

Spent

Cash

PAC %

Click district

Open dashboard

Support donor heatmaps.

Support future GIS overlays.

---

# CAMPAIGN RELATIONSHIP EXPLORER

This should become the flagship feature.

Build an interactive relationship graph.

Nodes:

Candidates

PACs

Committees

Donors

Businesses

Vendors

Cities

Districts

Edges represent:

Donations

Payments

Relationships

Shared vendors

Shared donors

Shared PACs

Clicking any node should filter every dashboard.

Support:

Zoom

Pan

Hover

Search

Animations

Relationship highlighting

This should work statewide.

---

# CAMPAIGN INTELLIGENCE CENTER

Create a statewide intelligence dashboard.

Examples:

Largest fundraiser

Largest cash on hand

Largest donor

Top PAC

Top Vendor

Most connected PAC

Most connected donor

Most connected vendor

Largest expense category

Fastest fundraising growth

Most self-funded campaign

Highest PAC percentage

Lowest PAC percentage

Top 25 donors

Top 25 vendors

Top 25 PACs

Recent filing activity

Recent imports

Suspicious patterns

Everything should be generated automatically.

---

# DETERMINISTIC INSIGHTS

Do NOT use AI.

Generate insights using rules.

Examples:

"72% of contributions came from individuals."

"Printing represented 38% of campaign spending."

"Campaign raised 43% more than previous filing."

"PAC funding increased."

"Cash on hand declined."

"Largest donor contributed 18%."

Return concise insight cards.


# Part 2 - Parallel Agent Assignments, Coding Standards, Testing, Roadmap & Final Requirements

---

# PARALLEL AGENT EXECUTION

Immediately divide this project into parallel workstreams.

Spawn as many coding agents as necessary.

Each agent owns its subsystem.

Each subsystem should expose documented interfaces.

Each subsystem should include:

- Documentation
- Unit tests
- Type definitions (JSDoc)
- Error handling
- Performance considerations

Agents should never duplicate responsibilities.

Merge completed work continuously.

---

# AGENT 1

## Project Architecture

Responsible for:

Repository layout

Configuration

Build process

GitHub Pages compatibility

Service Worker

PWA Manifest

Shared interfaces

Coding standards

Project documentation

README

Architecture diagrams

---

# AGENT 2

## UI / UX

Responsible for:

Sidebar

Navigation

Dashboard layout

Cards

Filter panels

Tables

Responsive design

Dark mode

Light mode

Accessibility

Keyboard shortcuts

Loading overlays

Toast notifications

Animations

Settings page

About page

Help page

No business logic.

---

# AGENT 3

## Kansas Import Service

Responsible for:

Discovering election cycles

Discovering filing periods

Discovering candidates

Discovering reports

Downloading PDFs

Incremental refresh

Avoiding duplicate downloads

Caching metadata

Retry logic

Progress indicators

Error handling

No UI.

---

# AGENT 4

## PDF Parsing Engine

Responsible for:

PDF.js integration

Text extraction

Table extraction

OCR tolerance

Normalization

Validation

Error reporting

Extract:

Summary

Schedule A

Schedule B

Schedule C

Schedule D

Candidate metadata

Reporting period

Office

District

Cash

Receipts

Expenses

Loans

Return clean JSON.

---

# AGENT 5

## Analytics Engine

Responsible for:

Raised

Spent

Cash

Loans

Average donation

Median donation

Largest donation

Small donor %

Repeat donors

Repeat vendors

Largest vendors

Expense categories

Timeline calculations

Growth calculations

Comparison metrics

Statistical summaries

Deterministic insights

No UI.

---

# AGENT 6

## PAC Detection Engine

Responsible for:

Known PAC database

Committee detection

Business detection

Individual detection

Organization detection

Confidence scoring

Manual overrides

Import/export PAC lists

Rule engine

Classification API

---

# AGENT 7

## Vendor Intelligence

Responsible for:

Vendor categorization

Automatic categories

Manual overrides

Duplicate vendor detection

Normalize vendor names

Top vendors

Vendor spending summaries

Shared vendors

Vendor statistics

---

# AGENT 8

## Search Engine

Responsible for:

Fuse.js

Global search

Advanced filters

Saved filters

Instant results

Highlighting

Search indexes

Autocomplete

Search history

---

# AGENT 9

## Dashboard Visualizations

Responsible for:

Chart.js

Bar charts

Pie charts

Treemaps

Timelines

Stacked bars

Histograms

Line charts

Donut charts

Export PNG

Export SVG

Print-friendly charts

---

# AGENT 10

## Relationship Explorer

This is the flagship feature.

Responsible for:

D3.js graph

Force-directed graph

Interactive graph

Relationships

Nodes:

Candidates

PACs

Committees

Individuals

Businesses

Vendors

Cities

Districts

Election cycles

Edges:

Donations

Payments

Shared vendors

Shared donors

Shared PACs

Shared cities

Click node

Highlight connected nodes

Filter dashboards

Animate graph

Search graph

Expand graph

Collapse graph

Export graph

---

# AGENT 11

## GIS Mapping

Responsible for:

Leaflet

District boundaries

County boundaries

Color scales

Heatmaps

Donor locations

ZIP clusters

Election overlays

Future GIS support

---

# AGENT 12

## Donor Explorer

Responsible for:

Donor search

Donation history

Repeat donors

Largest donors

Timeline

Cities

Occupation

Campaign history

Contribution totals

Relationship links

---

# AGENT 13

## Comparison Engine

Responsible for:

Candidate comparison

District comparison

Election cycle comparison

PAC comparison

Vendor comparison

Donor comparison

Summary dashboards

Comparison charts

Comparison exports

---

# AGENT 14

## Export Engine

Responsible for:

CSV

Excel

JSON

PNG

SVG

Printable PDF

Clipboard

Share URLs

Export selected data

Export dashboards

---

# AGENT 15

## Offline Storage

Responsible for:

IndexedDB

Cache management

Schema migrations

Versioning

Offline mode

Search indexes

User settings

Cached reports

Cache cleanup

---

# AGENT 16

## Rule-Based Intelligence

Generate automatic insights.

Examples:

Largest donor

Largest vendor

Largest PAC

Campaign trend

Cash trend

Expense trend

Fundraising trend

PAC dependence

Vendor concentration

Printing percentage

Advertising percentage

Timeline summaries

No AI.

Everything must be deterministic.

---

# AGENT 17

## Testing & QA

Responsible for:

Parser tests

Analytics tests

Search tests

Visualization tests

Performance tests

Accessibility tests

Cross-browser tests

GitHub Pages deployment tests

Regression tests

Documentation validation

---

# FILE OWNERSHIP

Every module owns its own folder.

No circular dependencies.

Keep imports clean.

No duplicated utilities.

Common code belongs in shared modules.

---

# CODING STANDARDS

Prefer readability.

Document every public function.

Use JSDoc.

Avoid global variables.

No inline JavaScript.

No inline CSS.

Use ES Modules.

Use async/await.

Gracefully handle failures.

Never silently fail.

Always log useful debugging information.

---

# PERFORMANCE REQUIREMENTS

Target:

10,000+

Reports

100,000+

Contributions

100,000+

Expenses

Thousands of donors

Thousands of vendors

Smooth interaction.

Lazy load large datasets.

Virtualize tables.

Cache aggressively.

---

# USER FEATURES

Dashboard

District dashboard

Candidate dashboard

Statewide dashboard

Contribution explorer

Expense explorer

PAC explorer

Committee explorer

Vendor explorer

Donor explorer

Relationship explorer

Map explorer

Comparison explorer

Campaign Intelligence Center

Settings

About

Help

---

# ADVANCED FILTERS

Election cycle

Office

District

Candidate

PAC

Committee

Vendor

City

County

ZIP

Contribution amount

Expense amount

Date

Occupation

Purpose

Expense category

Multiple selection filters

Saved filter presets

---

# EXPORTS

CSV

Excel

JSON

PNG

SVG

Printable dashboard

Share URL

Copy table

Copy chart

---

# GITHUB PAGES REQUIREMENTS

Deploy with GitHub Pages.

No backend.

No server.

Everything client-side.

No secrets.

No environment variables.

Works after cloning repository.

---

# README

Generate a professional README.

Include:

Overview

Architecture

Features

Screenshots placeholders

Installation

Deployment

GitHub Pages

Folder structure

Data model

Parser design

Relationship explorer

Campaign Intelligence Center

Roadmap

Contributing

License

FAQ

Known limitations

Future ideas

---

# ROADMAP

Version 1.0

District dashboards

Automatic imports

PDF parsing

Charts

Search

Relationship explorer

Exports

---

Version 1.5

Statewide analytics

Improved maps

Advanced filtering

Performance improvements

Offline support

---

Version 2.0

Historical election comparisons

Legislative trend analysis

Donor network analytics

Vendor intelligence

Conflict-of-interest indicators

Anomaly detection

Campaign finance timeline explorer

---

# STRETCH GOALS

Design the architecture so future additions are straightforward:

Federal campaign finance support

Lobbying reports

Kansas Ethics Commission filings beyond campaign finance

Campaign email archive integration

News integration

Candidate websites

Social media links

Interactive timeline playback

Donation flow animation

Influence scoring

Contribution clustering

Geographic fundraising analysis

Automatic anomaly detection using statistical methods

Duplicate donor detection

Duplicate vendor detection

Shared consultant detection

Shared treasurer detection

Shared campaign staff detection

Campaign ecosystem visualization

Public API (future)

Plugin system

Custom dashboards

User-defined calculations

---

# FINAL INSTRUCTION

Do not build a prototype.

Do not build a demo.

Build a polished, production-quality, open-source civic transparency platform.

Assume this project will eventually be hosted publicly and used by journalists, researchers, campaigns, watchdog organizations, educators, and Kansas citizens.

Optimize for:

Maintainability

Performance

Scalability

Extensibility

Documentation

Code quality

User experience

Accessibility

Professional design

When faced with multiple implementation options, choose the one that scales best to a statewide dataset spanning multiple election cycles.

Build something that sets the standard for state-level campaign finance transparency.