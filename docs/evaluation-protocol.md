# Evaluation protocol: how we measure the automatic story rules

Status: draft for General Counsel review (October 22, 2026). Documentation only. Nothing in this protocol turns on a new story type, loosens a rule, or changes what the site shows. It describes how evidence is collected and reported so that a decision about a new story type can be made on facts, following the approval standard in `docs/goodsignal-spec.md` section 11.

## 1. What this protocol is for

The automatic lane uses simple word rules (`server/publisher-screen.ts`). Their tests show that known mistakes do not come back. They do not show how often the rules are right on new stories. This protocol says how a person labels real stories, how those labels are counted, and what the report must say, so that nobody reads more into the result than it supports.

No accuracy percentage is claimed anywhere, in code, docs or public copy, until a report written under this protocol exists. Public copy never claims more than the lane achieves.

## 2. What is measured

Two questions are measured separately and never blended into one score.

1. **Safety:** of the stories the rules would list, how many did the person label Reject or Unsure? This is the number that decides whether a story type may be approved. One Reject or one Unsure in the sample means the type does not qualify.
2. **Missed good stories:** of the stories the rules held back, how many did the person label Keep, and for which reasons? This only helps us understand the rules. It never loosens a rule by itself, and it never counts toward approving a type.

## 3. Who labels, and how

- A person labels every story as Keep, Reject or Unsure. Today that person is Alex. When there is only one person, the report says so.
- Each story is shown with its headline and the publisher's own description. A label made from a headline alone does not count as evidence.
- The rules' decision is hidden while the person labels.
- Unsure means the person could not vouch for the story. It is counted against the type, as in section 11 of the spec.
- Labels made by an AI, including any AI second opinion, are always disclosed as AI labels and never count toward approval evidence.
- A person labels in sessions on their own schedule. Nobody is asked to label at a set hour.

## 4. Which stories count

- **One event, one result.** The same story seen in several feeds counts once.
- **Untouched days only.** A day counts as evidence only if no rule was written or tuned using that day's stories. When a day's stories are used to change a rule, that day is marked "used for tuning" in the report and never counts as evidence afterward.
- **After a rule change that could list more stories, start a new sample.** A change that can only exclude more stories (a stricter-only fix) does not restart the count, but the report records it.
- **One story type at a time.** Each candidate type (for example, stories held back only because the headline shows no completed outcome) is measured on its own sample.
- **Only stories that reached the rules.** Stories dropped earlier (missing author, rights notice, blocked credit, outside the date window) are never in the sample, so the sample measures the rules and not those earlier checks. The report says so.
- Picks made by a person ("Picked by PositiviTV") never count toward this evidence.

## 5. What the report must contain

- The dates covered, the policy version, the number of stories shown, and how many were labelled Keep, Reject and Unsure, split by the rules' decision (listed or held back) and by source.
- An uncertainty range for every rate (the Wilson interval used by the spec), because small samples can look better than they are.
- A comparison with two plain baselines at the same number of listed stories: a simple keyword filter, and a newest-first list with no filter.
- A plain statement of limits: how many people labelled; which sources hid their descriptions from the person; which earlier checks removed stories before the rules saw them; whether the sample is skewed toward certain sources or topics; and whether any days were used for tuning.
- No headline text, descriptions or links, and no anonymous story codes for stories labelled Reject. Aggregate counts only.

## 6. Decisions that follow from a report

- A report can support a proposal. It cannot approve anything. A new story type needs the approval standard in section 11 of the spec, then the General Counsel's review, then Alex's exact approval in writing.
- A later Reject that a person confirms on an approved type pauses that type automatically until it is reviewed again.
- Every approval and every pause is written down with its date, the sample size and who decided.
- Hard-ban reasons are never part of an approved type.

## 7. Data handling

- The private teaching batch holds the day's stories for at most 14 days. Descriptions live only there and on the private labelling page, and are deleted with their batch. The labelling page is deleted when scoring is done and no later than 30 days after collection.
- Headlines, descriptions and links stay out of the public repository, logs and run report. Anonymous codes for stories labelled Reject stay out of the public repository too.
- Deletion dates are recorded in `docs/publisher-feed.md`.

## 8. What this protocol does not do

It does not measure whether the underlying reporting is accurate, whether a story is suitable for every reader, whether the pins are exactly right, or how the lane performs in other languages. It does not replace the human review of the reviewed edition.
