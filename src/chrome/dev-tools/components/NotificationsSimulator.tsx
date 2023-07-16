import { createNotification } from 'chrome/helpers/chrome-notifications'
import { Box, Button, Header } from 'components'

export const NotificationsSimulator = () => {
  const examples = {
    basic: {
      type: 'basic',
      title: 'Basic Notification',
      message: 'This is a Basic Notification',
      iconUrl: '/radix-icon_128x128.png',
      buttons: [
        {
          title: 'Button 1',
        },
        {
          title: 'Button 2',
        },
      ],
    },
    progress: {
      type: 'progress',
      title: 'Progress Notification',
      message: 'This is a Progress Notification',
      iconUrl: '/radix-icon_128x128.png',
      progress: 80,
    },
    list: {
      type: 'list',
      title: 'List Notification',
      message: 'This is a List Notification',
      iconUrl: '/radix-icon_128x128.png',
      items: [
        { title: 'list element 1', message: 'list message 1' },
        { title: 'list element 2', message: 'list message 2' },
      ],
    },
    image: {
      type: 'image',
      title: 'Image notification title',
      message: 'Image notification message',
      iconUrl: '/radix-icon_128x128.png',
      imageUrl: '/radix-icon_128x128.png',
    },
  }
  const show = async (type: 'basic' | 'progress' | 'list' | 'image') => {
    const noti = chrome.notifications.create(
      crypto.randomUUID(),
      examples[type] as any,
      (id) => {
        console.log(id)
      },
    )
    console.log(noti)
  }
  return (
    <>
      <Header dark>Notifications</Header>
      <Box flex="row">
        <Button onClick={() => show('basic')}>Show Basic with buttons</Button>
        <Button onClick={() => show('list')}>Show List</Button>
        <Button onClick={() => show('progress')}>Show Progress</Button>
        <Button onClick={() => show('image')}>Show Image</Button>
        <Button
          onClick={() =>
            createNotification(
              undefined,
              'Radix Dev Tools',
              'With this, extension options are respected',
            )
          }
        >
          Show CE notification
        </Button>
        <Button onClick={() => createNotification(undefined, 'Title')}>
          Show CE notification without message
        </Button>
        <Button
          onClick={() => createNotification(undefined, undefined, 'Message')}
        >
          Show CE notification without title
        </Button>
      </Box>
    </>
  )
}
