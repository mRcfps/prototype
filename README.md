# Tuture

[![Build Status](https://travis-ci.com/tutureproject/tuture.svg?branch=master)](https://travis-ci.com/tutureproject/tuture)

Tuture is a tool for generating tech tutorials with high quality based on Git repositories.

*Read this in other languages*: [简体中文](README.zh-CN.md).

## Installation

Make sure you have [Node.js](https://nodejs.org/) (>= 8.0.0) and [npm](https://www.npmjs.com/) (>= 5.0.0) on your machine.

- **install with npm**

```bash
$ npm i -g tuture
```

- **install from source**

Clone this repo to your machine, and run following command:

```bash
$ npm i -g
```

## Using Tuture CLI

Following commands assume that you are working on a Git repo. If you does not have Git on your machine, please download it from [here](https://git-scm.com/downloads).

### `tuture init`

Initialize a Tuture tutorial.

Tuture will prompt you to answer following questions:

| Prompt             | Fields     | Required/Optional | Default            | Meaning                                                      |
| ------------------ | ---------- | ----------------- | ------------------ | ------------------------------------------------------------ |
| Tutorial Name?     | `name`     | Required          | My Awesome Project | Title of this tutorial                                       |
| Tutorial Language? | `language` | Required          | English            | Language of this tutorial                                    |
| Topics?            | `topics`   | Optional          | -                  | Topics of this tutorial, separated with spaces or commas, such as `express,mongodb` |
| Maintainer email?  | `email`    | Optional          | -                  | Maintainer email of this tutorial                            |

Then following files will be generated:

- **tuture.yml**. This file is a record of metadata and explainations of the tutorial, and here is one possible example:

```yaml
name: Name of this tutorial
language: English
topics:
  - Topic A
  - Topic B
maintainer: maintainer@example.com
steps:
  - name: Commit message of commit ae05546
    commit: ae05546
    explain: Explain what will be done in this step
    diff:
      - file: Changed file A
        explain: Explain why this change happens
      - file: Changed file B
        explain: Explain why this change happens
  - name: Commit message of commit ae05546
    commit: a45bec1
    explain: Explain what will be done in this step
    diff:
      - file: Changed file A
        explain: Explain why this change happens
      - file: Changed file B
        explain: Explain why this change happens
      - file: Changed file C
        explain: Explain why this change happens
```

- **.tuture** directory. This houses diff data used by Tuture.

```
.tuture
└── diff
    ├── 084a277.diff
    ├── e4a9539.diff
    ├── f898719.diff
    └── fefe569.diff
```

Meanwhile, following rules will be appended to your `.gitignore` (Tuture will create one if not exists):

```
# Tuture supporting files
.tuture
```

### `tuture up`

Build the tutorial and open it in your browser.

### `tuture destroy`

Delete all tuture-related files.

## How to write a Tuture tutorial

Writing a Tuture tutorial is incredibly simple and delightful.

1. Initialize a Git repo (or start from an existing one)

2. Write some code and commit with a meaningful message

3. Run `tuture init` to initialize a Tuture tutorial

4. Write some instructions in related `explain` fields in **tuture.yml**

5. Run `tuture up` to see your tutorial live in the browser

6. Edit **tuture.yml** and save to change something
