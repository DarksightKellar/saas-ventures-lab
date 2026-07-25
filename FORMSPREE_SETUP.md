# SubTrack Waitlist — Formspree Claim URL

Click this link to create the SubTrack waitlist form pre-configured with all fields:

https://formspree.io/claim?name=SubTrack+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100,prettyName:Your+Name&field.email=email,required,prettyName:Email&field.channel=text,prettyName:How+did+you+hear+about+us?&field.project=text,prettyName:Project

After clicking:
1. Sign in / sign up to Formspree.
2. Confirm the form creation.
3. Copy the form ID (e.g. `xwkdzbng` from `https://formspree.io/f/xwkdzbng`).

Then paste it into `public/deploy/subtrack.html` on line ~83, replacing `YOUR_FORMSPREE_ID_HERE`.

## If you want email notifications (recommended)

Add `&action.email=your@email.com` to the claim URL before clicking:

https://formspree.io/claim?name=SubTrack+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100,prettyName:Your+Name&field.email=email,required,prettyName:Email&field.channel=text,prettyName:How+did+you+hear+about+us?&field.project=text,prettyName:Project&action.email=YOUR_EMAIL_HERE

Replace `YOUR_EMAIL_HERE` with your real email.

## Free tier limits

- 50 submissions/month across ALL forms (all 10 projects share this pool)
- Email notifications included
- No API access (manual "+1" on dashboard)

If one project crosses 50 waitlist signups, upgrade to Professional ($20/mo annual) for API
access + webhooks → dashboard auto-imports signups with zero manual entry.

## Per-project claim URLs (bookmark these)

SubTrack:   https://formspree.io/claim?name=SubTrack+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
PricePulse: https://formspree.io/claim?name=PricePulse+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
ReviewReply: https://formspree.io/claim?name=ReviewReply+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
ClientReport: https://formspree.io/claim?name=ClientReport+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
LegalQuick:  https://formspree.io/claim?name=LegalQuick+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
RoadActive:  https://formspree.io/claim?name=RoadActive+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
ProofPilot:  https://formspree.io/claim?name=ProofPilot+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
SnapDeduct:  https://formspree.io/claim?name=SnapDeduct+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
LinkFlow:    https://formspree.io/claim?name=LinkFlow+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
MeetingMinutes: https://formspree.io/claim?name=MeetingMinutes+Waitlist&project=saas-ventures-lab&field.name=text,maxlength:100&field.email=email,required&field.channel=text&field.project=text&action.email=YOUR_EMAIL
