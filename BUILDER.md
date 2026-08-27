# 🧱 App Maker

A no-code app engine in one file: **`builder.html`**. Open it in any browser and
build a small app by tapping — no programming, no AI, nothing to install, no
account, no network. What you build can be saved out as a single web page that
runs on its own.

It grew out of this repo's `index.html`: the same "one self-contained file that
behaves like an app on a phone" idea, turned into something you assemble by hand
instead of writing.

## Open it

Double-click `builder.html`, or host the repo (e.g. GitHub Pages) and visit
`/builder.html`. On iPhone, **Share → Add to Home Screen** makes it full-screen.

Everything lives in that browser's local storage. Nothing is uploaded anywhere.

## The idea in four words

**Screens · blocks · values · actions.** That's the whole engine.

### Screens

An app is a stack of screens; buttons move between them. Every app starts with
one. Add more with **＋**, tap the open screen's chip again to rename or delete
it. A ‹ Back button appears automatically once you've navigated somewhere.

### Blocks

Each screen is a list of blocks, added from a picker and reordered with ↑ ↓:

| Block | What it is |
|---|---|
| Heading, Text | Words on the screen |
| Image | A picture from a web address |
| Text box | Someone types something in |
| Number picker | − / + buttons around a number |
| Switch | On / off |
| Choices | Pick one of several options |
| List | The items in a list, tickable and deletable |
| Big number | One value, shown large |
| Progress bar | How far towards a goal |
| Button | Does things when tapped |
| Divider, Space | Layout |

### Saved values

Anything the app should remember is a **saved value**: a piece of text, a number,
a yes/no, or a list. They keep their contents when the app is closed and
reopened. Blocks that need one can make it on the spot — pick
*+ Make a new one…* in any value dropdown.

Show a value anywhere text is accepted by writing its short name in braces:

```
Hello {name}, you have {todo.left} of {todo.count} left.
```

Lists also offer `{list.count}`, `{list.done}` and `{list.left}`. That is the
engine's entire expression language — deliberately, because it's the one thing
here that looks like code.

### Actions

A button (or a Choices block) runs a short sequence, each step picked from a
menu:

- Go to a screen / Go back
- Set a value · Add to a number · Flip a switch
- Add an item to a list · Empty a value
- Show a message · Open a web link · Reset everything

So "add what's in the text box to my list, then clear the box" is two taps in a
menu, not a line of code.

### Only show this when…

Every block can be given a condition — *only show this when Score is more than
2*, *only when Name is not empty*. That covers most of what people otherwise
reach for `if` statements to do: validation, congratulation screens, empty
states.

## Starting points

**New app** offers Blank, To-do list, Tally counter, Habit tracker, Quiz, Notes
and Form. They're ordinary apps made of the same blocks — open one up and change
anything.

## Keeping and sharing what you make

Under the **App** tab:

- **Save as an app file (.html)** — one self-contained page holding your app and
  the runtime. Mail it, host it, open it on a phone, add it to the home screen.
  It works offline and saves its own data, with no trace of the builder.
- **Save a backup (.json)** — the app's description, which *Bring in a backup*
  on the home screen reads back in.

## What it deliberately can't do

Knowing the edges is part of knowing whether it fits:

- No custom formulas or arithmetic beyond "add N to a number".
- No repeating a screen over a list — a list is shown by the List block.
- No server, accounts, sharing between devices, or notifications. Each copy
  keeps its own data in its own browser.
- No dates, timers or charts yet.

Those are the natural next blocks, and they fit the same model.

## For developers

`builder.html` is plain ES5-ish JavaScript in one file, no dependencies, and
splits in half:

- **Runtime** — every `rt*` function, plus `RT_CSS`. It turns an app description
  into a working app and is self-contained: exporting serialises these very
  functions (`RUNTIME_FNS.map(f => f.toString())`) into the generated page, so the
  builder and an exported app run identical code.
- **Editor** — the visual builder. `BLOCKS` and `ACTIONS` are schemas: each
  entry lists the questions the editor asks, and `control()` renders the right
  input for each. Adding a block type means adding one entry to `BLOCKS` and one
  branch to `rtBlock()`; adding an action means one entry in `ACTIONS` and one
  `case` in `rtDo()`.

An app is JSON:

```js
{ id, name, icon, theme,
  fields:  [ {key, label, type: "text"|"number"|"toggle"|"list", initial} ],
  screens: [ {id, name, blocks: [ {id, type, ...settings, when, actions} ]} ] }
```

Saved data is separate from the description, under `appmaker.data.<app id>`, so
an exported app carries the design and grows its own contents.
