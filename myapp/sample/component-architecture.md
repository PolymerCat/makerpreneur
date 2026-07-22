# StudentHub Component Architecture

This project now uses reusable React and TypeScript components instead of copying the static `/sample/StudentHub USM.html` prototype as one page.

## Route Structure

Each main app area has its own Next.js App Router page:

- `/` - dashboard
- `/community` - feed, people, and community building blocks
- `/study` - planner and resources
- `/events` - MyCSD metrics and event listings
- `/campus` - campus services and contacts
- `/profile` - profile summary and social lists
- `/signin` - standalone sign-in screen

This keeps navigation URL-based and makes each page easier to hydrate with Supabase data later.

## Component Folders

### `components/layout`

Use these for app-wide page structure.

- `AppShell` wraps authenticated app pages with the sidebar/mobile navigation.
- `MainNav` highlights the current route using `usePathname`.
- `PageHero` gives each route a consistent page header without forcing a fixed page design.

### `components/ui`

Use these as design primitives. They should stay generic.

- `Avatar`
- `Badge`
- `ButtonLink`
- `Card`
- `Icon`
- `MetricCard`
- `SectionHeader`

These components should not fetch data. They receive props and render UI.

### `components/domain`

Use these for StudentHub-specific repeated patterns.

- `TaskList`
- `EventList`
- `FeedList`
- `PeopleList`
- `ResourceList`

These components know about app data shapes, but they still receive data through props.

## Data Layer

Temporary seed data lives in:

- `lib/types.ts`
- `lib/sample-data.ts`

The pages import arrays from `sample-data.ts` for now. When Supabase is added, keep the component props the same and replace the page-level data source.

Example future pattern:

```tsx
import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/domain/TaskList";

export default async function StudyPage() {
  const supabase = await createClient();
  const { data: tasks = [] } = await supabase.from("tasks").select("*");

  return <TaskList tasks={tasks} />;
}
```

## Design Workflow

The current styles are intentionally a flexible app layout, not a 100% copy of the sample:

- Desktop uses a sidebar navigation.
- Mobile switches to a bottom navigation.
- Cards, badges, metrics, lists, and page headers are independent building blocks.
- Page designs can be changed by recomposing components rather than rewriting app logic.

When adding a new feature, prefer this flow:

1. Add or reuse a type in `lib/types.ts`.
2. Create temporary seed data in `lib/sample-data.ts`.
3. Build a small component in `components/domain` if the pattern is app-specific.
4. Compose the component inside an App Router page.
5. Replace seed data with Supabase queries when the schema is ready.
