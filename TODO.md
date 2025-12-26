## Summary

Web App for managing a personal "watch list" for movies and tv series.
In the following the word item is used and can mean a tv series or a movie.
A user can add items that he wants to watch or is currently watching.
The list keeps track of which items were last watched and tells the user what the next item is that he has to watch.
The user can click a button to tell that he watched the current item.
The user can mark an item as watched completly.
The user can create groups and put items in them.
For example he can put all movies inside a movie group or create a group to contain all anime series etc..

## Architecture

The app is made with angular.
I already created the example angular workspace with `ng new watch-list`.
The data is stored in the local storage of the browser.
The website should work offline. This means it should implement service workers. It can use the [SwUpdate service](https://angular.dev/ecosystem/service-workers/communications#swupdate-service).

## Definitions

- Item: Either a movie or a TV series.
- The initial state of an item is not started
  - For series that means its season 1 episode 1 in unwatched state
  - For movies this simple means an unwatched state
- Movie: Considered complete after a single "watched" action.
- Series: Contains a current progress state (season, episode).
- Watched episode action: Advances the progress of a series by exactly one episode.
- Completed item: An item that is fully watched and excluded from "next to watch" suggestions.

## Watching Logic

- The app enforces a round-robin watching rule:
  - A series may not be suggested again until at least one episode of every other non-completed series has been watched.
- The app tracks a "lastWatchedAt" timestamp per item.
- The "next item to watch" is selected by:
  1. Filtering out completed items
  2. Sorting by lastWatchedAt ascending
- new items have lastWatchedAt set to the current date

## Ordering

- The order is decided by round-robin watching rule

## Groups

- Groups are user-defined collections of items.
- Groups can not be nested.
- An item can belong only to one group.
- Groups have their own ordering.
- Groups can be collapsed or expanded in the UI.
- An Item can not exist without a group. The UI for adding an item should set a default "Ungrouped" group.

## Data Storage

- All data is stored in browser localStorage.
- A version field is stored alongside the data schema.
- The app must function without network access after the first load.
- If the app has internet access it should display a hint if it finds a new version is available. It should ask if the user wants to update.
- The app does not need to handle storage overflow gracefully

### localStorage schema

``` json
{
  "schemaVersion": 1,
  "lastModifiedAt": "2025-01-01T12:00:00.000Z",
  "settings": {
    "showCompleted": false
  },
  "groups": {
    "ungrouped": {
      "id": "ungrouped",
      "name": "Ungrouped",
      "order": 0
    },
    "movies": {
      "id": "movies",
      "name": "Movies",
      "order": 1
    }
  },
  "items": {
    "item-uuid-1": {
      "id": "item-uuid-1",
      "type": "series",
      "title": "Example Series",
      "groupId": "ungrouped",
      "status": "in-progress",
      "progress": {
        "season": 1,
        "episode": 3,
        "totalEpisodes": 12
      },
      "lastWatchedAt": "2025-01-01T10:00:00.000Z",
      "createdAt": "2024-12-31T20:00:00.000Z"
    },
    "item-uuid-2": {
      "id": "item-uuid-2",
      "type": "movie",
      "title": "Example Movie",
      "groupId": "movies",
      "status": "not-started",
      "lastWatchedAt": "2025-01-01T11:00:00.000Z",
      "createdAt": "2024-12-31T21:00:00.000Z"
    }
  }
}
```

## Import / Export

- Export produces a single JSON file containing all user data.
- Import fully replaces existing data.
- Import requires explicit user confirmation.
- Invalid or corrupted JSON must be rejected with an error message.

## Progress & visibility

- Show progress indicators:
  - “Episode 3 of 12”
  - “75% complete”
  - episode totals are user-provided
  - episode totals are optional and it should display only the following then
    - "Episode 3"
- Show last watched date
- Show time since last watched

## Series episode progression rules

- If a series has no episode totals at all and the user keeps clicking “watched”. It adds the next episode automatically
- If a user clicks "watched" on the last episode the whole series is marked as completed

## Filtering & views

- Completed / in-progress / not started
- The main homepage shows “What should I watch now?” view
- When all series are completed it should still use the filter on the "What should I watch now?" view and display an empty list

## Movies

- Movies have their own round-robin logic
- They are a seperate queue and the user can decide if he wants to watch a movie or a series
- Movies have their own “What Movie should I watch now?” view

## Application Scope

The app is intentionally single-user, local-only, and metadata is entered manually.

## Delete an item

The user can delete an item.
