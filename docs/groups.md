# Assignee groups

A group is a named set of a project's members, such as Pharmacy or Nursing. An issue can be
assigned to a group, next to its person assignee or instead of it.

## Manage groups

Project Settings → **Groups** lists the project's groups. Add a group, choose its color, and
pick its members. Only members of the project can be in a group. A person who leaves the
project leaves its groups. Deleting a group clears it from the issues assigned to it.

A new project copied from another one gets the same groups, with the copying member as the
only member of each, because the copy starts with no other members. Clear **Groups** in the
copy options to skip them.

## Assign an issue

Every assignee picker, the bulk bar, the command palette, and the new issue form offer the
groups below the members. Every member of the group gets an `assigned` notification, except
the person who made the change. A member who is also the person assignee is notified once.

A group shows as a chip on cards. It is also a filter, a grouping on boards, and a display
property in tables.

## Actions

A project action can set the assignee group. Add the **Assignee group** field to the
action's effect, choose a group, or leave it empty to clear the group. Running the action
assigns the group and notifies its members like a manual assignment.

## Assigned to me

The filter bar has an **Assigned to** field with two values:

- **Me**: issues whose assignee is you.
- **Me or my groups**: issues assigned to you or to a group you belong to.

The **Assignee** field also accepts **Me**, and the **Assignee group** field accepts
**My groups**. These values are resolved for whoever opens the view, so one saved view lists
different issues for each person. A public link has no viewer, so these values match nothing
there.

## Dashboards

The breakdown widget can count issues **By group**.

## API and MCP

- `GET /projects/:projectKey/groups` and the other group routes manage groups.
- `assigneeGroupId` or `assigneeGroupName` on an issue create or update sets the group.
- `GET /projects/:projectKey/issues?assignedTo=me` lists the caller's issues.
  `assignedTo=meOrMyGroups` adds the issues of the caller's groups. The `list_issues` MCP
  tool and the agent tool take the same `assignedTo` value.
- `GET /projects/:projectKey/analytics/breakdown?by=assigneeGroup` counts issues by group.
