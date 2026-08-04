import { describe, it, expect, vi, afterEach } from "vitest";
import { slackProvider } from "./slack.provider";
import { microsoftTeamsProvider } from "./microsoftTeams.provider";
import { discordProvider } from "./discord.provider";
import { NotificationProviderError } from "../../errors";
import type { NotificationMessage } from "../types";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — each
 * provider's own real, vendor-documented payload shape (Slack's
 * `attachments`, Teams' classic `MessageCard`, Discord's `embeds`),
 * checked against a mocked webhook POST so a shape regression (a
 * renamed field, a wrong color encoding) fails a test instead of only
 * being discoverable by pasting a real webhook URL in by hand.
 */

const MESSAGE: NotificationMessage = {
  title: "Lead Created",
  body: 'Event "lead.created" occurred at 2026-06-01T10:00:00.000Z.',
  severity: "success",
  attachments: [{ label: "Name", value: "Jane Doe" }],
  links: [{ label: "View Lead", url: "https://app.example.com/admin/leads/lead_1" }],
  mentions: ["@channel"],
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOk() {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("ok", { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

interface ParsedWebhookBody {
  attachments?: { color: string; title: string; text: string; fields: { title: string; value: string; short: boolean }[] }[];
  "@type"?: string;
  "@context"?: string;
  summary?: string;
  title?: string;
  sections?: { facts: { name: string; value: string }[] }[];
  embeds?: { color: number; fields: { name: string; value: string; inline: boolean }[] }[];
  content?: string;
}

function requestBody(fetchMock: ReturnType<typeof mockFetchOk>): ParsedWebhookBody {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as ParsedWebhookBody;
}

function mockFetchFail(status = 400) {
  global.fetch = vi.fn(async () => new Response("bad request", { status })) as unknown as typeof fetch;
}

describe("slackProvider.send — real Slack Incoming Webhook 'attachments' shape", () => {
  it("posts to the given webhook URL with a color-coded attachment carrying title/text/fields", async () => {
    const fetchMock = mockFetchOk();
    await slackProvider.send("https://hooks.slack.com/services/x", MESSAGE);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/x",
      expect.objectContaining({ method: "POST" }),
    );
    const body = requestBody(fetchMock);
    expect(body.attachments![0].color).toBe("#2EB67D"); // severity: success
    expect(body.attachments![0].title).toBe("Lead Created");
    expect(body.attachments![0].fields).toEqual([{ title: "Name", value: "Jane Doe", short: true }]);
    expect(body.attachments![0].text).toContain("@channel");
    expect(body.attachments![0].text).toContain("View Lead");
  });

  it("throws NotificationProviderError when Slack rejects the request", async () => {
    mockFetchFail(404);
    await expect(slackProvider.send("https://hooks.slack.com/services/x", MESSAGE)).rejects.toThrow(NotificationProviderError);
  });
});

describe("microsoftTeamsProvider.send — real classic MessageCard shape", () => {
  it("posts a MessageCard with @type/@context and facts derived from attachments", async () => {
    const fetchMock = mockFetchOk();
    await microsoftTeamsProvider.send("https://outlook.office.com/webhook/x", MESSAGE);

    const body = requestBody(fetchMock);
    expect(body["@type"]).toBe("MessageCard");
    expect(body["@context"]).toBe("http://schema.org/extensions");
    expect(body.summary || body.title).toBeTruthy();
    const facts = body.sections?.[0]?.facts ?? [];
    expect(facts).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Name", value: "Jane Doe" })]));
  });

  it("throws NotificationProviderError when Teams rejects the request", async () => {
    mockFetchFail(500);
    await expect(microsoftTeamsProvider.send("https://outlook.office.com/webhook/x", MESSAGE)).rejects.toThrow(NotificationProviderError);
  });
});

describe("discordProvider.send — real embeds shape, color as decimal (not hex)", () => {
  it("posts an embed with a decimal-integer color and inline fields", async () => {
    const fetchMock = mockFetchOk();
    await discordProvider.send("https://discord.com/api/webhooks/x", MESSAGE);

    const body = requestBody(fetchMock);
    expect(body.embeds![0].color).toBe(0x2eb67d); // decimal, not "#2EB67D" — the one real format difference
    expect(typeof body.embeds![0].color).toBe("number");
    expect(body.embeds![0].fields).toEqual([{ name: "Name", value: "Jane Doe", inline: true }]);
    expect(body.content).toBe("@channel");
  });

  it("throws NotificationProviderError when Discord rejects the request", async () => {
    mockFetchFail(429);
    await expect(discordProvider.send("https://discord.com/api/webhooks/x", MESSAGE)).rejects.toThrow(NotificationProviderError);
  });
});
