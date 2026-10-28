# Cart Saver for iHerb

Check promo codes against your actual iHerb cart, compare the total, and apply your choice.

**Beta · English by default · 中文 available · MIT licensed · Independent of iHerb**

## Install and use

Version 0.3.1 has been submitted to Chrome Web Store for review; publication has not yet been confirmed. This source contains version 0.3.2, prepared for the next store update. Once approved, the store will provide **Add to Chrome** and automatic extension updates. Regular users will not need GitHub, an AI key, a server, or any configuration.

For an early developer preview, download the extension ZIP from a maintainer-published GitHub release, unzip it, enable Developer mode at `chrome://extensions`, and select **Load unpacked**. This is a developer preview, not the one-click store installation.

1. Open your iHerb cart with a supported delivery country and currency.
2. Click the Cart Saver icon. Checking starts immediately on the cart, tries up to six candidate codes, then restores your original code when possible. From another page, choose **Open iHerb cart**, then click the icon on your cart.
3. Review **Total if applied** and choose **Apply · save**. The panel confirms **Applied · current total**; choose **Done** to close it. Review iHerb's final checkout total before paying.

Reopening an existing panel keeps its results; **Check again** runs a new comparison. Other ways to save, tested-code details and cashback stay out of the main action. If no tested code improves the price, relevant alternatives expand automatically.

The beta supports Australia, the United States and Singapore, with AUD, USD and SGD prices. Codes follow the delivery country, not your VPN, display language or currency alone. The shared official-offer feed updates every six hours. Expired feed records are not treated as fresh codes, and a code is never guaranteed to work just because it appears in the feed.

Cashback reminders are optional and matched separately to your cashback account market. They are not included in the instant saving, and Cart Saver does not activate cashback, add affiliate identifiers, or promise that a coupon will qualify for cashback.

## Privacy and feedback

Cart information is processed locally to compare prices and detect changes. Cart contents, addresses, purchase histories, passwords and payment details are not uploaded to the shared feed. The feed receives an ordinary HTTPS request, including network metadata such as IP address. There are no analytics or advertising trackers in the extension.

- [Privacy policy](https://iherb-cart-saver-feed.vercel.app/privacy.html)
- [Help and feedback](https://iherb-cart-saver-feed.vercel.app/support.html)
- [Report a bug or suggest a feature](https://github.com/Su1System/iherb-cart-saver/issues/new/choose) — GitHub account required; reports are public. Remove personal details from screenshots.

The popup also links directly to feedback, privacy and source. Opening feedback does not attach or send cart data automatically.

## Development

Node 24 and Python 3.12 are used in CI. Python 3.10 also works for the local tools.

```sh
npm ci --ignore-scripts
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
npm test
python tools/check_python.py
python tests/browser_test.py
python tools/build.py
python tests/package_test.py
```

Open `demo/index.html` to try the interactive demo. It uses fixed simulated prices and never accesses an iHerb account. `python tests/extension_test.py` is an additional real-MV3 integration test against a simulated merchant and the live public offer feed; it is not part of offline fork-PR CI. It makes no paid collector calls or purchases.

`python tools/store_assets.py` produces the store screenshots and listing assets in `dist/store/`. The screenshots use a clearly labelled simulated cart, not a real shopper's account.

## Architecture

- `extension/`: Manifest V3 popup, on-demand cart adapter, comparison engine and cached public feed client. All executable code is bundled; remote updates contain JSON offer data only.
- `tools/update_offers.py`, `publish_offers.py`: market-bound official-source collection and durable publication. The optional Jina source is maintained centrally; users do not supply a key.
- `tools/reader_budget.py`: persistent request, daily and monthly limits; failures retain conservative reservations.
- `api/` and `server/`: HTTPS JSON distribution. Public reads never invoke the paid collector.
- `deploy/`: optional self-hosted systemd units. Hosting is not required to use the extension.

For a self-hosted instance, configure server-only `JINA_API_KEY` if using the reader, `IHERB_SOURCE_BACKEND=reader`, `IHERB_STATE_DIR` and `IHERB_PUBLISH_MODE=origin`. Keep private credentials and certificates outside the repository. The HTTPS origin may be linked through `IHERB_ORIGIN_URL` and the pinned public CA `IHERB_ORIGIN_CA`. Point `extension/feed-config.js` and its matching manifest host permission at your own feed before building. Do not run a second publisher alongside an existing owner without deciding which source is authoritative.

## Contributing and releases

Fork → branch → pull request. External contributions require maintainer review; they cannot merge themselves. See [CONTRIBUTING.md](CONTRIBUTING.md). CI uses fixture tests without credentials or paid services. Only maintainers publish releases and submit updates to Chrome Web Store. The `Package candidate` workflow creates artifacts for review; it does not publish a release or upload to the store.

Observed live beta checks covered AU and US carts with restore/reapply behavior. SG routing and cashback matching have fixture coverage; full live SG cart compatibility remains unverified. Site changes or account-specific offers can affect results. This project does not guarantee the lowest price on the internet.

License: [MIT](LICENSE). Not affiliated with or endorsed by iHerb, Google or cashback providers.
