# Claude Code — Persistent Repository Intelligence System

You are an AI software engineering agent operating inside a repository.
Your purpose is not merely to edit files. You are operating as part of a persistent repository intelligence system designed to make complex, multi-file, multi-session software engineering more reliable.
The system provides:

* Persistent project knowledge
* Structured dependency information
* Machine-queryable SQLite knowledge
* Semantic and exact retrieval through RAG
* Targeted iterative investigation
* Temporary working memory
* Context degradation recovery
* Starting-from-zero recovery
* Historical knowledge
* Verification
* Ghost testing
* Git workflow automation
* Human-readable durable documentation

The fundamental goal is to prevent the AI from repeatedly having to reconstruct an entire repository from scratch.
Instead, the repository should maintain an externalized, searchable engineering memory that the AI can query as needed.

---

## 1. Core Architecture

The system consists of several distinct layers.

```text
                         USER
                           │
                           ↓
                     CLAUDE CODE
                           │
                           ↓
                      CLAUDE.md
                           │
                  operating instructions
                           │
                           ↓
                    context/*.md
                   (primary knowledge)
                           │
                           ↓
                    SQLite knowledge
                     database (index)
                           │
                ┌──────────┴──────────┐
                │                     │
         realignment record     task-specific data
                │                     │
                ↓                     ↓
         realignment.md       relevant context
                                      │
                                      ↓
                              targeted retrieval
                                      │
                         ┌────────────┴────────────┐
                         ↓                         ↓
                    exact search                 RAG
                         │                         │
                         └────────────┬────────────┘
                                      ↓
                              relevant source
                                  + context
                                      ↓
                              LLM working memory
                                      ↓
                                  reasoning
                                      ↓
                                code changes
                                      ↓
                              ghost test (mental dry-run)
                                      ↓
                                verification
                                      ↓
                         durable knowledge discovered
                                      ↓
                              context/*.md
                                      ↓
                              SQLite synchronization
```

Each layer has a distinct purpose.

---

## 2. Source Code

The actual repository source code remains the ultimate implementation truth.

```text
src/
tests/
package.json
...
```

The AI must inspect source code when implementation details matter.
Context documentation must not blindly override actual source behavior.
If documentation and source code disagree:

1. Identify the discrepancy.
2. Investigate it.
3. Treat current source behavior as authoritative for implementation.
4. Update the context documentation if appropriate.

Tests and verification provide additional evidence.

---

## 3. `CLAUDE.md`

`CLAUDE.md` is the AI-facing entry point and operating instruction layer.
It should contain the instructions necessary for Claude Code to understand and operate the repository intelligence system.
It should NOT contain the entire project's knowledge.
Its purpose is to tell Claude:

* That persistent project knowledge exists
* Where that knowledge is stored (context/ folder primary; SQLite as index)
* How to recover from context degradation
* How to update durable knowledge
* How the Git workflow operates

The important relationship is:

```text
CLAUDE.md
    ↓
explains the system
    ↓
.ai/knowledge.db  (query first)
    ↓
find relevant information → context/*.md
```

`CLAUDE.md` should explicitly reference:

```text
.ai/knowledge.db
context/realignment.md
```

and explain that SQLite is queried first to find what is relevant, and context/*.md are the human-readable documents that SQLite points to.

---

## 4. CLAUDE.md Must Point to the Realignment System

Claude Code must be instructed that if it:

* Starts a new session
* Has insufficient context
* Loses important earlier context
* Becomes uncertain about the project's architecture
* Detects contradictory assumptions
* Has forgotten why an implementation exists
* Is continuing work from another session
* Is otherwise experiencing context degradation

it should not guess and should not immediately scan the entire repository.
Instead:

```text
CLAUDE.md
    ↓
SQLite realignment record
    ↓
realignment.md
    ↓
foundational context docs
    ↓
task-specific retrieval
```

SQLite is the machine-readable entry point. Query it first, then read the context docs it points to.

---

## 5. Context Directory

The preferred context structure is:

```text
context/
├── overview.md
├── architecture.md
├── dependencies.md
├── decisions.md
├── constraints.md
├── known-problems.md
├── failed-solutions.md
├── current-task.md
├── verification.md
├── handoff.md
├── realignment.md
├── gitContext.md
│
└── archive/
    ├── legacy-context/
    ├── historical-handoffs/
    └── old-task-notes/
```

The system may add additional specialized context documents when genuinely useful.
Do not create unnecessary documents merely for the sake of having more files.

The context/ folder is human-readable and kept up to date. It is maintained for both humans and AI. The AI uses SQLite to find which documents are relevant, then reads those documents.

---

## 6. `overview.md`

Contains the project's high-level mental model.
Include:

* Project purpose
* Main functionality
* Major subsystems
* Technology stack
* External services
* Important terminology
* High-level architecture

A new engineer should be able to understand what the project fundamentally is from this document.

---

## 7. `architecture.md`

Contains the project's architectural structure.
Document:

* Major components
* Layers
* Responsibilities
* Boundaries
* Data flow
* Control flow
* Architectural rules
* Important coupling
* Important separation of concerns

Example:

```text
Frontend
    ↓
API
    ↓
Service Layer
    ↓
Database
```

Focus on relationships and responsibilities, not merely lists of files.

---

## 8. `dependencies.md`

Contains important relationships between project components.
Include:

* Imports
* Calls
* Dependencies
* Data relationships
* Runtime relationships
* Upstream/downstream relationships
* Important dependency chains

Example:

```text
AuthService
    ↓
TokenManager
    ↓
SessionManager
```

These relationships should also be represented structurally in SQLite.

---

## 9. `decisions.md`

Contains durable engineering and architectural decisions.
For significant decisions record:

```text
Decision:
Reason:
Alternatives:
Tradeoffs:
Relevant context:
```

This prevents future AI sessions from treating intentional architecture as unexplained code.

---

## 10. `constraints.md`

Contains hard requirements and invariants.
Examples:

```text
Public API cannot change without explicit approval.

Database migrations must remain backwards compatible.

Payment operations must be idempotent.

Authentication behavior must remain compatible with existing clients.
```

Constraints should receive high priority during reasoning.

---

## 11. `known-problems.md`

Contains:

* Known bugs
* Technical debt
* Fragile areas
* Performance problems
* Compatibility issues
* Architectural weaknesses
* Areas requiring caution

A known problem does not necessarily mean the current task should fix it.

---

## 12. `failed-solutions.md`

This is persistent negative knowledge.
Record approaches that have already been attempted and failed.
Use a structure such as:

```text
Attempt:
Result:
Why it failed:
Relevant files:
Lesson:
```

The purpose is to prevent future sessions from repeatedly trying the same unsuccessful approaches.
Failed approaches should not be deleted simply because they are inconvenient.

---

## 13. `current-task.md`

Contains the currently active task.
Include:

```text
Goal:
Current state:
Relevant components:
Relevant files:
Established facts:
Open questions:
Current hypothesis:
Known blockers:
Next steps:
```

This document represents current active work rather than a permanent chronological log.
When the task changes, update it.

---

## 14. `verification.md`

Contains the project's verification procedures.
Include:

* Tests
* Type checking
* Linting
* Builds
* Static analysis
* Integration checks
* Manual checks
* Important invariants
* Edge cases

Example:

```text
npm test
npm run lint
npm run typecheck
npm run build
```

Prefer executable verification wherever possible.

---

## 15. `handoff.md`

Contains the important state needed for another AI session to continue the current work.
Include:

```text
Current task:
Completed:
Important discoveries:
Important files:
Implementation state:
Remaining work:
Known problems:
Important decisions:
Next recommended investigation:
```

Keep this document focused.
Do not allow it to become an unlimited chronological transcript.

---

## 16. Long Handoff Management

If `handoff.md` becomes excessively large, analyze it semantically.
Do NOT simply keep appending to it forever.
Extract durable information into the appropriate documents.
For example:

```text
Architecture knowledge
    ↓
architecture.md

Dependency knowledge
    ↓
dependencies.md

Design decisions
    ↓
decisions.md

Failed attempts
    ↓
failed-solutions.md

Known issues
    ↓
known-problems.md

Current task
    ↓
current-task.md

Historical session information
    ↓
archive/historical-handoffs/
```

The active `handoff.md` should remain a concise representation of what another session actually needs.

---

## 17. Multiple Handoff Files

If the existing repository contains:

```text
handoff.md
handoff-old.md
handoff-2025.md
handoff-2026.md
session-notes.md
```

do not arbitrarily choose one.
Analyze all potentially relevant information.
Determine:

* Current information
* Historical information
* Duplicate information
* Conflicting information
* Durable knowledge
* Current task state
* Information suitable for archival

Preserve useful information.
If information conflicts, explicitly investigate the conflict using:

* Current source code
* Tests
* Git history
* More recent context
* Current repository state
* Explicit decisions

Do not silently discard conflicting knowledge.

---

## 18. `realignment.md`

`realignment.md` is the context recovery map.
It exists specifically for:

* Starting from zero
* Starting a new AI session
* Recovering from context loss
* Recovering from context degradation
* Reconstructing the project's mental model
* Resolving uncertainty about where project knowledge lives

It should NOT contain every detail about the project.
Instead, it tells the AI what to retrieve and in what general order.
Example:

```text
# Repository Realignment

Read these in order:

1. overview.md
2. architecture.md
3. current-task.md
4. constraints.md
5. dependencies relevant to the current task
6. relevant decisions
7. relevant known problems
8. relevant failed solutions
9. handoff.md if active session state is needed

Then retrieve the relevant source files through targeted retrieval/RAG.

Do not load the entire repository unless specifically required.
```

The document should also describe:

* Foundational context
* Task-dependent context
* How to determine what is current
* How to recover when information conflicts
* Where historical knowledge lives
* How to rebuild working memory

---

## 19. Realignment SQLite Record

The SQLite database contains a dedicated realignment record.
The record references:

* `realignment.md`
* Foundational context documents
* Current task information
* Core architectural information
* Important constraints
* Dependency entry points

This is the machine-readable entry point for recovering project context. Query this first before reading any context documents.

---

## 20. Context Degradation Recovery

If the AI notices that its context has degraded, it must not simply continue based on uncertain assumptions.
Examples of degradation:

* Forgetting important architectural decisions
* Forgetting dependencies
* Losing track of the current task
* Contradicting previous established facts
* Not remembering why a component works a certain way
* Starting a new session
* Having a long conversation where older information is no longer available

Recovery process:

```text
Detect context degradation
        ↓
Read CLAUDE.md instructions
        ↓
Read context/realignment.md
        ↓
Retrieve foundational context
        ↓
Retrieve current task
        ↓
Retrieve relevant dependencies
        ↓
Retrieve relevant decisions/problems
        ↓
Retrieve handoff if necessary
        ↓
Targeted source retrieval
        ↓
Rebuild working memory
        ↓
Continue task
```

Do not restart by blindly scanning the entire repository.

---

## 21. Starting From Zero

If the AI has effectively no useful project context:

```text
CLAUDE.md
    ↓
context/realignment.md
    ↓
overview.md
    ↓
architecture.md
    ↓
current-task.md
    ↓
constraints.md
    ↓
relevant dependencies
    ↓
relevant source
```

The objective is to construct the minimum sufficient mental model for the task.

---

## 22. Existing Context Migration

The system MUST support repositories that already have a different context structure.
Do not assume the repository is new.
First inspect for:

* Existing `context/`
* Documentation
* AI instruction files
* Handoff files
* Session notes
* Architecture files
* Existing databases
* Project-specific knowledge systems

If an existing context structure exists, migrate it into the new structure.
Do NOT create a second independent context system beside it.

---

## 23. Migration Must Preserve Information

Migration must follow:

```text
Existing context
        ↓
Inventory
        ↓
Analyze meaning
        ↓
Classify
        ↓
Consolidate
        ↓
Split where necessary
        ↓
Deduplicate
        ↓
Archive historical information
        ↓
Create new context structure
        ↓
Index into SQLite
```

Never delete information merely because it does not fit the new structure.
If relevance is uncertain, preserve it.

---

## 24. Migration of Large Files

Do not assume a large file should remain a large file.
For example, if an existing `handoff.md` contains thousands of lines, identify the meaning of its contents.
Potentially distribute information into:

```text
architecture.md
dependencies.md
decisions.md
constraints.md
known-problems.md
failed-solutions.md
current-task.md
handoff.md
archive/
```

Split according to semantic meaning rather than arbitrary line counts.

---

## 25. Archive

Historical information that is no longer useful as active context but remains valuable should be moved into:

```text
context/archive/
```

Possible structure:

```text
context/archive/
├── legacy-context/
├── historical-handoffs/
├── old-task-notes/
└── old-decisions/
```

Archive information rather than deleting it when historical preservation is useful.
Archived material may remain indexed and searchable.

---

## 26. SQLite Knowledge Database

Create:

```text
.ai/knowledge.db
```

SQLite is the machine-queryable knowledge layer — an index of the human-readable context/*.md documents, not a replacement for them.
Possible tables include:

```text
files
symbols
imports
references
calls
dependencies
data_flows
context_documents
context_sections
context_relationships
constraints
decisions
failed_solutions
known_problems
verification_rules
tasks
handoffs
realignment
git_configuration
```

The schema may evolve as implementation requirements become clearer.

---

## 27. SQLite Is Not the Sole Source of Truth

The database is a machine-readable representation/index of the project's durable knowledge.
The system must be designed so that the database can be regenerated from:

```text
source code
+
context/*.md
```

if necessary.
Do not make the system permanently dependent on an unrecoverable SQLite database.
The database can always be regenerated from context/*.md via `python .ai/rebuild_db.py`.

---

## 28. SQLite Context Relationships

SQLite should connect project entities.
Example:

```text
refreshToken()
    ↓
related context
    ├── architecture.md
    ├── constraints.md
    └── failed-solutions.md
```

Another example:

```text
auth.ts
    ↓
CALLS
    ↓
refreshToken()
```

This allows efficient queries such as:

```text
What calls this function?
What depends on this file?
What context documents concern this component?
What constraints apply here?
What failed approaches are associated with this system?
What information should I retrieve to understand this task?
```

---

## 29. Dependency Graph

Maintain machine-readable relationships such as:

```text
source              relationship       target

auth.ts             IMPORTS            token.ts
auth.ts             CALLS              refreshToken()
payment.ts          DEPENDS_ON         database.ts
checkout.ts         CALLS              processPayment()
```

Support upstream/downstream traversal.

---

## 30. RAG

RAG is the retrieval layer used to obtain relevant information for the LLM.
RAG should be able to retrieve from:

* Source code
* Documentation
* Context documents
* Context sections
* Symbols
* Exact text
* Semantic similarity
* Metadata

Do not rely solely on vector similarity.
Use a combination of:

```text
Exact search
+
Symbol search
+
SQLite relationships
+
Dependency graph
+
Semantic retrieval
+
Metadata
```

---

## 31. SQLite → Retrieval → RAG

The normal workflow should be:

```text
Task
 ↓
SQLite (or direct context/ read)
 ↓
"What information is relevant?"
 ↓
Context records
 ↓
Relevant source/symbol/dependency records
 ↓
Targeted retrieval
 ↓
RAG
 ↓
Actual relevant content
 ↓
LLM
```

The AI must use SQLite to determine what it needs, then use retrieval/RAG to obtain the actual content.

---

## 32. Targeted Retrieval

Never repeatedly scan the entire repository simply because one piece of information was missing.
Use:

```text
retrieve
 ↓
reason
 ↓
identify missing information
 ↓
targeted SQLite query
 ↓
targeted retrieval/RAG
 ↓
reason again
```

Track what has already been retrieved and avoid unnecessary duplicate retrieval.

---

## 33. Working Memory

The active LLM context is temporary working memory.
Maintain concepts such as:

```text
CURRENT GOAL
ESTABLISHED FACTS
RELEVANT FILES
IMPORTANT DEPENDENCIES
CONSTRAINTS
CURRENT HYPOTHESIS
REJECTED HYPOTHESES
OPEN QUESTIONS
VERIFICATION STATUS
```

Prune information that is no longer relevant.
If discarded information becomes relevant again, retrieve it.

---

## 34. Permanent Knowledge vs Working Memory

Permanent knowledge:

```text
Source code
context/*.md
SQLite knowledge
Archived knowledge
```

Temporary knowledge:

```text
Current working memory
Current retrieval results
Current hypotheses
Current investigation state
```

Do not force the LLM to carry permanent knowledge inside every context window.
Retrieve it when needed.

---

## 35. Knowledge Promotion

Not every thought should become permanent project knowledge.
Promote information when it is:

* Durable
* Reusable
* Architecturally significant
* A hard constraint
* An important dependency
* A discovered bug
* A failed approach
* A significant decision
* Important to future sessions

Do not fill context documents with disposable reasoning.

---

## 36. Updating Context

When durable knowledge is discovered:

```text
Discovery
    ↓
Identify correct context category
    ↓
Update Markdown
    ↓
Update SQLite
```

Examples:

```text
Architecture discovery → architecture.md
Dependency discovery   → dependencies.md
New constraint         → constraints.md
Failed experiment      → failed-solutions.md
New bug                → known-problems.md
Task state             → current-task.md
Session state          → handoff.md
```

---

## 37. SQLite Synchronization

Whenever context Markdown changes:

```text
Markdown changed
      ↓
detect/update
      ↓
SQLite reflects new information
```

The database should not drift indefinitely from the Markdown.
The system should support re-indexing/rebuilding when necessary (`python .ai/rebuild_db.py`).

---

## 38. Ghost Test (Mental Dry-Run)

Before executing a code change, the AI must perform a ghost test: a mental simulation of the change to verify understanding before touching any files.

```text
Planned change identified
        ↓
Ghost test:
  - Mentally trace the change through all affected files
  - Identify all call sites, consumers, and dependents
  - Verify that the change is consistent with constraints
  - Check for sentinel/constant sync requirements
  - Check for duplicate files that must also change
  - Predict the expected outcome
  - Identify any side effects
        ↓
Inconsistency found?
  ├── YES → revise plan, ghost test again
  └── NO  → proceed with actual changes
```

Example ghost test for a sentinel change:

```text
"I am about to change NEEDS_MANUAL_REVIEW.
Ghost test:
  - shared/checkingName.js → must change ✓
  - WebUI/src/checkingName.jsx → must change ✓
  - NativeAppUI/checkingName.js → must change ✓
  - API/checkingName.py → must change ✓
  - ProcessingContext.jsx compares against this value → downstream effect?
  - ManualReviewSequentialModal compares against this value → downstream effect?
  All 4 files identified. No downstream string comparisons need changes.
  Safe to proceed."
```

The ghost test is mandatory before:
- Any change to a sentinel or constant defined in multiple files
- Any change to a shared utility
- Any architectural change that could affect multiple consumers
- Any change in an area flagged in known-problems.md or constraints.md
- Any change the AI is uncertain about

Never skip the ghost test to save time. A wrong change caught during ghost testing costs nothing. A wrong change caught after is expensive.

---

## 39. Verification

After modifying code:

```text
Reason
 ↓
Ghost test (mental dry-run)
 ↓
Modify
 ↓
Run verification
 ↓
Evaluate
```

If verification fails:

```text
Failure
 ↓
Investigate
 ↓
Targeted retrieval
 ↓
Ghost test again
 ↓
Modify
 ↓
Verify again
```

If verification succeeds:

```text
Verification passed
 ↓
Review changes
 ↓
Update durable knowledge if necessary
```

Never declare success merely because the code appears correct.

---

## 40. Evidence Hierarchy

When information conflicts, use:

```text
Observed/tested behavior
        ↓
Current source code
        ↓
Explicit current constraints/decisions
        ↓
Current context documentation
        ↓
Historical context
        ↓
AI assumptions
```

If uncertainty remains, investigate.
Do not invent missing information.

---

## 41. Git Bootstrap

If the working folder is completely empty and has no Git repository/upstream:
Ask: What repository HTTP URL should I clone and configure?
Do not invent the URL.
After receiving it:

```text
URL
 ↓
clone repository
 ↓
configure upstream
 ↓
initialize/read repository intelligence system
```

---

## 42. Existing Git Repository

If a Git upstream already exists, use `context/gitContext.md` and its corresponding SQLite configuration.

Example:

```yaml
upstream:
trigger_word:
base_branch: main
branch_prefix: ai/
auto_merge: false
```

---

## 43. Git Trigger Workflow

When the configured trigger word is explicitly used, perform the defined Git workflow.
Conceptually:

```text
Current work
    ↓
Dedicated AI branch
    ↓
git add .
    ↓
meaningful commit
    ↓
push
    ↓
create Pull Request
    ↓
WAIT FOR USER
    ↓
user merges into main
```

The commit message must meaningfully describe the changes.

---

## 44. Git Branching

AI work should occur on a dedicated branch when the configured workflow requires it.
Example: `ai/fix-auth-refresh`
Do not silently perform the workflow directly on `main`.

---

## 45. No Automatic Merge

Default: `auto_merge: false`
Do not automatically merge the Pull Request into `main`.
After pushing and creating the PR, wait for the user to merge it.

---

## 46. Normal Task Lifecycle

The complete normal workflow is:

```text
USER
 ↓
Task
 ↓
Claude Code
 ↓
CLAUDE.md
 ↓
Read context/realignment.md + relevant context docs
 ↓
(optionally) SQLite knowledge query
 ↓
Determine relevant context
 ↓
Determine relevant dependencies/source
 ↓
Targeted retrieval/RAG
 ↓
Build working memory
 ↓
Missing information?
 ├── YES → targeted retrieval
 └── NO
 ↓
Ghost test (mental dry-run of planned change)
 ↓
Inconsistency found?
 ├── YES → revise plan
 └── NO
 ↓
Modify code
 ↓
Run verification
 ↓
Pass?
 ├── NO → investigate/fix/ghost test/verify
 └── YES
 ↓
Determine whether durable knowledge changed
 ↓
Update context/*.md
 ↓
Update SQLite
 ↓
Task complete
```

---

## 47. New Session Lifecycle

A new session should begin with the persistent knowledge system rather than assuming conversational memory exists.

```text
New session
 ↓
CLAUDE.md
 ↓
SQLite realignment record
 ↓
context/realignment.md
 ↓
Current task / relevant context
 ↓
Dependencies
 ↓
Handoff if necessary
 ↓
Targeted source retrieval
 ↓
Working memory
 ↓
Continue
```

---

## 48. Migration Lifecycle

If the repository already has context:

```text
Existing repository
 ↓
Inspect CLAUDE.md
 ↓
Inspect existing context system
 ↓
Inventory existing knowledge
 ↓
Analyze semantics
 ↓
Classify
 ↓
Split/consolidate
 ↓
Archive historical material
 ↓
Create target context structure
 ↓
Create realignment.md
 ↓
Update CLAUDE.md
 ↓
Build SQLite knowledge database
 ↓
Create realignment SQLite record
 ↓
Index context/dependencies/source
 ↓
Normal operation
```

Do not lose information during migration.

---

## 49. The Roles of Each Component

Keep these distinctions clear.

```text
CLAUDE.md
= AI operating instructions / system entry point

context/*.md
= durable human-readable project knowledge (primary)

realignment.md
= human-readable map for rebuilding project understanding

SQLite
= machine-queryable index of project knowledge (optional accelerator)

Dependency graph
= structured relationships between project entities

RAG
= retrieval mechanism

Ghost test
= pre-change mental simulation / consistency check

Working memory
= temporary relevant information for the current reasoning process

LLM
= reasoning, planning and code generation

Tests/verification
= external validation

Git
= controlled delivery/versioning
```

---

## 50. What the AI Should NOT Do

Do not:

* Load the entire repository into the LLM context unnecessarily.
* Read every context document for every task.
* Repeatedly scan the entire repository when targeted retrieval is sufficient.
* Treat SQLite as the sole source of truth.
* Treat Markdown as disposable cache data.
* Delete existing project knowledge during migration merely because it is difficult to organize.
* Repeatedly attempt known failed approaches.
* Allow active handoff files to grow without limit.
* Guess when context has been lost.
* Assume documentation is correct without checking implementation.
* Assume implementation is correct without verification.
* Skip the ghost test before a change.
* Automatically merge PRs unless explicitly configured.
* Guess missing repository URLs.
* Silently discard conflicting historical information.
* Store every transient thought permanently.

---

## 51. Final System Mental Model

The complete system should be understood as:

```text
                         CLAUDE.md
                             │
                   "How should I operate?"
                             │
                             ↓
                       context/*.md
                    (primary knowledge)
                             │
                    ┌────────┴────────┐
                    │                 │
            realignment.md      task-specific docs
                    │                 │
                    └────────┬────────┘
                             │
                    (optionally also)
                             │
                      SQLite knowledge
                             │
                ┌────────────┴────────────┐
                │                         │
       Realignment record          Task-specific records
                │                         │
                └────────────┬────────────┘
                             ↓
                       What do I need?
                             │
                             ↓
                    Targeted retrieval
                             │
                   ┌─────────┴─────────┐
                   ↓                   ↓
              Exact search           RAG
                   │                   │
                   └─────────┬─────────┘
                             ↓
                       Relevant source
                       + context
                             │
                             ↓
                       WORKING MEMORY
                             │
                             ↓
                            LLM
                             │
                         reasoning
                             ↓
                        GHOST TEST
                    (mental dry-run)
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
               INCONSISTENT       CONSISTENT
                    │                 │
                    ↓                 ↓
               revise plan       CODE CHANGES
                    │                 │
                    └────────┬────────┘
                             ↓
                       VERIFICATION
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
                  FAIL              PASS
                    │                 │
                    ↓                 ↓
               investigate       update knowledge
                    │                 │
                    └───────┬─────────┘
                            ↓
                       context/*.md
                            ↓
                    SQLite synchronization
                            ↓
                    persistent knowledge
```

The fundamental philosophy is:
Do not give the AI everything. Give it the ability to efficiently discover exactly what it needs.
Do not make the AI rely on conversation memory. Give it persistent external memory.
Always query SQLite first. It is the mandatory entry point into the knowledge system.
Do not make SQLite the only source of truth. Keep durable knowledge human-readable in Markdown.
Do not skip the SQLite query step. It is mandatory — always query SQLite before reading context docs.
Do not make `realignment.md` a giant context dump. Make it a map that tells the AI how to reconstruct the project.
Do not make `CLAUDE.md` the project's memory. Make it the entry point that tells Claude how to access the memory system.
Do not repeatedly scan the repository. Retrieve information iteratively and specifically as reasoning discovers what is missing.
Do not modify code without a ghost test. Always simulate the change mentally before touching files.
Do not trust reasoning alone. Verify changes externally.
Do not throw away historical knowledge. Preserve, classify, consolidate and archive it.

The resulting system is:

```text
              Repository
                  +
             CLAUDE.md
                  +
             Context Memory
             (context/*.md)
                  +
           SQLite (index)
                  +
         Dependency Graph
                  +
               RAG
                  +
          Targeted Retrieval
                  +
            Ghost Testing
                  +
          Working Memory
                  +
                LLM
                  +
            Verification
                  +
             Git Workflow
                  =
       Persistent AI Engineering System
```

Its purpose is to turn Claude Code from an AI that repeatedly reconstructs a project's understanding from whatever happens to fit into its current context window into an AI agent that operates over a persistent, searchable, structured and continuously improving model of the repository.
