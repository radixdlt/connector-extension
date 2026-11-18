import { useLocalStore } from 'chrome/helpers/use-local-store'
import { defaultWalletSort, type WalletSort } from 'pairing/state/wallet-order'
import {
  DragIndicatorIcon,
  LinkIcon,
  PhoneIcon,
  PulseIcon,
  SortByAlphaIcon,
} from 'ui/icons'
import { SettingsSection } from '../settings-ui'
import type { ScreenProps } from './screen'
import { ChoiceRows, SettingsSubPage, type Choice } from './sub-page'

export const walletSortChoices: Record<WalletSort, Choice> = {
  custom: {
    title: 'Custom order',
    subtitle: 'As you arrange them: drag the cards, or Move Up and Down',
    icon: <DragIndicatorIcon />,
  },
  name: {
    title: 'Name',
    subtitle: 'Alphabetical, from A to Z',
    icon: <SortByAlphaIcon />,
  },
  recentlyLinked: {
    title: 'Recently linked',
    subtitle: 'The wallet linked last comes first',
    icon: <LinkIcon />,
  },
  recentlyUsed: {
    title: 'Recently used',
    subtitle: 'The wallet that answered a dApp last comes first',
    icon: <PulseIcon />,
  },
  connected: {
    title: 'Connected first',
    subtitle: 'Connected wallets first, then in your order',
    icon: <PhoneIcon />,
  },
}

export const WalletOrderSettings = ({ page }: ScreenProps) => {
  const [sort, setSort] = useLocalStore('walletSort', defaultWalletSort)

  return (
    <SettingsSubPage title="Sort wallets" page={page}>
      <SettingsSection
        title="Order of the linked wallets"
        radioGroup
        description="Moving a wallet by hand switches to your custom order."
      >
        <ChoiceRows
          name="walletSort"
          choices={walletSortChoices}
          value={sort}
          loaded={sort !== undefined}
          onSelect={setSort}
        />
      </SettingsSection>
    </SettingsSubPage>
  )
}
