import { slackProvider } from "./providers/slack.provider";
import { microsoftTeamsProvider } from "./providers/microsoftTeams.provider";
import { discordProvider } from "./providers/discord.provider";
import type { NotificationProvider, NotificationProviderId } from "./types";

/** The one place allowed to import a concrete notification-provider
 *  adapter, mirroring lib/services/calendar/registry.ts (Module 6.3)
 *  and lib/services/storage/registry.ts (Module 6.2) exactly. */
const NOTIFICATION_PROVIDERS: Record<NotificationProviderId, NotificationProvider> = {
  slack: slackProvider,
  microsoft_teams: microsoftTeamsProvider,
  discord: discordProvider,
};

export const NOTIFICATION_PROVIDER_IDS: NotificationProviderId[] = Object.keys(NOTIFICATION_PROVIDERS) as NotificationProviderId[];

export function isNotificationProviderId(value: string): value is NotificationProviderId {
  return (NOTIFICATION_PROVIDER_IDS as string[]).includes(value);
}

export function getNotificationProvider(id: NotificationProviderId): NotificationProvider {
  return NOTIFICATION_PROVIDERS[id];
}
