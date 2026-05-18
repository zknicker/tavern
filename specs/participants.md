# Profiles And Participants

Tavern separates Tavern-owned people from runtime-observed identities.

This keeps provider details out of product surfaces while avoiding fragile automatic merges across
Discord, Slack, iMessage, Telegram, or OpenClaw.

## Model

- A `profile` is a Tavern-owned person record.
- The self profile is `profile:self`.
- Profile presentation, such as display name, avatar, and color, is Tavern-owned local state.
- A `participant` is one observed source identity from one runtime/provider/account/external id.
- A participant is not "self" and does not carry an `is_self` flag.
- A `participant label` is an observed display label for that participant.
- A `profile participant` link manually associates a participant with a profile.

## Tables

- `profiles`: Tavern-owned profile presentation.
- `participants`: observed provider identity with `provider`, `account_key`, `external_id`, and
  current observed name.
- `participant_labels`: observed labels for one participant.
- `profile_participants`: manual many-to-one links from observed participants to profiles.

The runtime sync layer owns participant observation. The profile layer owns profile links and
presentation.

## Identity Rules

- Same provider/account/external id resolves to the same participant.
- Different providers do not automatically resolve to the same person.
- Same display names do not automatically resolve to the same person.
- Display names are labels, not identity.
- Profile links are manual because they assert that observed identities belong to one Tavern
  profile.

Before linking, Tavern renders a participant using its best observed label. After linking, Tavern
renders the linked profile presentation while preserving the participant id as provenance.

## Runtime Mapping

The OpenClaw adapter normalizes provider-native data before Tavern stores it.

Examples:

| Runtime fact | Tavern participant |
| --- | --- |
| Discord user id `778786269458464829` | `provider=discord`, `external_id=778786269458464829` |
| Telegram user id `123456` | `provider=telegram`, `external_id=123456` |
| iMessage address `+15551234567` | `provider=imessage`, `external_id=+15551234567` |

Provider-specific parsing belongs in the runtime adapter package. Tavern Runtime API receives
normalized participants and labels.

## Rendering

- Chat, message, and participant surfaces render participants through the profile link when one
  exists.
- Linked rendering should not rewrite stored message actor ids. Messages authored by an observed
  participant still point at that participant.
- The UI may show linked profile presentation for that participant.
- Tavern self-authored local messages may use `actor.kind=profile` with `id=profile:self`.

## Non-Goals

- No automatic cross-provider person merge.
- No `is_self` on participants.
- No provider-specific fields leaking into frontend display logic except as explicit provenance.
