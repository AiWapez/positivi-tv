import Icon from './Icon';

export default function ReaderInfo({ page, savedCount, onClear, readCount = 0, onClearRead, visitCounter = false }: {
  page: 'privacy' | 'terms'; savedCount: number; onClear: () => void; readCount?: number; onClearRead?: () => void; visitCounter?: boolean;
}) {
  if (page === 'terms') return <>
    <p className="eyebrow">Reading PositiviTV™</p><h2 id="dialog-title">Free to explore.</h2>
    <p>You can browse without an account. PositiviTV™ brings together constructive reporting; original publishers remain responsible for their articles. A reviewed story can still contain an error or need a correction.</p>
    <h3>Sources and dates</h3><p>Read story opens the original publisher in a new tab. That website has its own content, privacy practices and terms, and may have a paywall. Publication dates and event dates are separate. Stories marked Reviewed by PositiviTV™ were approved by an editor. Stories marked From publisher feeds were selected automatically from permitted feeds; their event dates are not confirmed and the selection rules can make mistakes. Picked by PositiviTV stories also come from publisher feeds, but a person at PositiviTV chose each one individually. They aren't fact-checked, and their event dates aren't confirmed. Refresh reads the latest saved stories; it does not create reporting or start a new search.</p>
    <h3>Photos</h3><p>Cards use credited location photos or subject illustrations. Their captions explain the context, and photo credits link to the source and license.</p>
    <h3>Design samples</h3><p>The sample edition contains fictional layout examples. It is labelled throughout and kept separate from reviewed news.</p>
    <h3>Using the code</h3><p>GitHub is where the project code lives. You do not need a PositiviTV™ account to download or fork an accessible repository. Check its license and asset credits before reuse; publisher articles are not part of the code license.</p>
    <h3>Corrections</h3><p>To flag a factual or source-link issue, use the repository’s issue tracker. Include the article link and the concern, and leave out personal information. You will need a GitHub account to submit an issue.</p>
    <a className="secondary" href="https://github.com/AiWapez/positivi-tv/issues" target="_blank" rel="noopener noreferrer">Report a story issue <Icon name="external" /></a>
    <p className="filter-note">Updated October 14, 2026. Accounts and community uploads are not available in this release.</p>
  </>;
  return <>
    <p className="eyebrow">Your privacy</p><h2 id="dialog-title">Explore without a profile.</h2>
    <p>This release has no sign-up, behavioral analytics, advertising trackers, session recordings or public submissions. Search and category choices stay in this page; we do not send them to a personalization service.</p>
    {visitCounter && <><h3>A simple visit counter</h3><p>[Draft wording, pending General Counsel] To show roughly how many people visit, the page counts at most one visit per browser per day. The counter stores only a date and two numbers, a total and that day's count. It does not store who you are, your address, your device or where you came from, and it uses no cookies. The number is approximate. The remembered date stays in this browser, and clearing this site's data in your browser settings removes it.</p></>}
    <h3>Favorites stay on this device</h3><p>Saving a story stores its ID in your browser. We do not sync favorites to a server. Other people using this browser may see them. Clearing browser storage also removes them.</p>
    <button className="secondary" disabled={!savedCount} onClick={onClear}>Clear saved stories ({savedCount})</button>
    <h3>Reading history stays on this device</h3><p>Opening a story marks it read in your browser. Its pin dims and stays on the globe, and stories you have not opened show at full strength. The browser also remembers which daily update you have already seen, so the update note shows once. We do not send this history to a server, and each browser or device keeps its own. Clearing it removes the dimming from every pin.</p>
    <button className="secondary" disabled={!readCount || !onClearRead} onClick={onClearRead}>Clear reading history ({readCount})</button>
    <h3>What still travels over the internet</h3><p>Your browser requests the website’s files and story feed from our hosting provider, Vercel. Hosting infrastructure can process IP addresses and request metadata to deliver and protect the service. No website can promise that simply removing accounts removes all data processing.</p>
    <p>The globe texture, font, story photos and sample pictures load from this website. Opening a publisher, GitHub or an imagery credit takes you to a separate website with its own privacy practices.</p>
    <h3>Younger readers</h3><p>You do not need to give us your age, name, email, photo or location to read. Please do not put personal information in a public issue report. Accounts, uploads and any optional analytics will need a separate privacy and safety review before they are introduced.</p>
    <p className="filter-note">Updated October 15, 2026. This notice describes this release, including the labelled sample edition.</p>
  </>;
}
