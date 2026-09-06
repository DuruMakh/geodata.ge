import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Message } from "../../lib/i18n/message";

it("allows translated sentence order while keeping number markup and escaping source names", () => {
  const html = renderToStaticMarkup(<Message messages={{ sentence: "{amount} for {name}." }} id="sentence" values={{ amount: <span className="numeric">2.2 bn GEL</span>, name: "<source>" }} />);
  expect(html).toBe('<span class="numeric">2.2 bn GEL</span> for &lt;source&gt;.');
});

it("rejects missing rich-message values with the same strict contract as plain messages", () => {
  expect(() => renderToStaticMarkup(<Message messages={{ sentence: "{amount} for {name}." }} id="sentence" values={{ amount: 0 }} />)).toThrow("name");
});
