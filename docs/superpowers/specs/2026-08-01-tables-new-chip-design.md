# "NEW" chip on The Tables nav item

Date: 2026-08-01
Status: approved

## Problem

The site launches to the wider community tomorrow. The Tables (pods) feature is
unlike anything else in the SWU community, but its nav label is thematic and a
casual visitor may gloss past it. The label itself stays: it fits the all-thematic
nav and the home page teaches the term two sections in. What is missing is a
marker that points the eye at the one nav item that is genuinely new.

## Design

A small "NEW" sticker-chip next to "The Tables" in the site header, on every page.

**Component:** Extend `TablesNavDot` in `website/src/app/tables-live.tsx` rather
than adding a second component. Today it returns `null` when tables are idle and
a blue dot when a lobby is open or pods are running. New behavior:

- Default state (no snapshot yet, or tables idle): render the "NEW" chip.
- Active state (lobby open or pods playing): render the existing blue dot.

They never stack. When tables are live, the dot is the stronger signal anyway.
Because the chip is the default state, it renders immediately on page load with
no pop-in while the poll fetch is in flight.

**Look:** Sticker vocabulary the site already speaks. Tiny uppercase "NEW" in
`--hot` pink on ink, slight tilt, sitting right after the label text. Same visual
family as the "This Sunday. All are welcome." tag on the flyer.

**No copy changes.** The home Tables section and the /play signed-out card ship
as they are; the /play card already explains the format at the moment of intent.

## Removal plan

Once the community knows pods exist (a few weeks), delete the chip branch and the
component goes back to being just the live dot. A comment in the code names this
intent so the chip does not outlive its job.

## Testing

Visual check in the browser on home and /play: chip in the idle state, dot when a
lobby is open. A render branch with no logic worth a unit test.
