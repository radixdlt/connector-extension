# Offscreen Page Communication with Wallet

This document explains how the offscreen page communicates with the wallet in the connector extension.

## Architecture Overview

The offscreen page maintains connections with wallets and handles message routing between dApps, the extension, and wallets. It uses WebRTC for real-time communication with wallets through the `ConnectorClient`.

### High-Level Architecture Diagram

```mermaid
graph TD
    dApp[dApp] <--> CS[Content Script]
    CS <--> BG[Background Script]
    BG <--> OS[Offscreen Page]
    OS <--> Wallet[Wallet]
    
```

## Connection Setup

- The offscreen page maintains a [`WalletConnectionClient`](../src/chrome/offscreen/wallet-connection/wallet-connection-client.ts) for each connected wallet, stored in a `connectionsMap`.
- Each `WalletConnectionClient` uses WebRTC for real-time communication with the wallet through the `ConnectorClient`.
- The main offscreen page setup is defined in [`offscreen.ts`](../src/chrome/offscreen/offscreen.ts).

### Connection Setup Diagram

```mermaid
graph TD
    OS[Offscreen Page] --> CM[Connections Map]
    CM --> WCC1[WalletConnectionClient 1]
    CM --> WCC2[WalletConnectionClient 2]
    CM --> WCCn[WalletConnectionClient n]
    
    WCC1 --> CC1[ConnectorClient 1]
    WCC2 --> CC2[ConnectorClient 2]
    WCCn --> CCn[ConnectorClient n]
    
    CC1 --> W1[Wallet 1]
    CC2 --> W2[Wallet 2]
    CCn --> Wn[Wallet n]
    
    class OS,CM,WCC1,WCC2,WCCn,CC1,CC2,CCn component;
    class W1,W2,Wn wallet;
```

## Message Flow Architecture

The communication is handled through several queues:

- `dAppRequestQueue`: Handles messages from dApps to the wallet
- `extensionToWalletQueue`: Handles messages from the extension to the wallet
- `incomingWalletMessageQueue`: Handles incoming messages from the wallet

These queues are defined in the [`WalletConnectionClient`](../src/chrome/offscreen/wallet-connection/wallet-connection-client.ts).



## Message Types and Handling

The [`WalletConnectionMessageHandler`](../src/chrome/offscreen/wallet-connection/message-handler.ts) processes different types of messages:

### Wallet to Extension Messages

```typescript
case messageDiscriminator.walletMessage: {
  if (isLedgerRequest(message.data)) {
    // Handle ledger requests
  } else if (isExtensionMessage(message.data)) {
    // Handle extension-specific messages (accountList, linkClient)
  } else {
    // Handle other wallet messages
    incomingWalletMessageQueue.add(message.data, message.data.interactionId)
  }
}
```

### dApp to Wallet Messages

```typescript
case messageDiscriminator.walletInteraction: {
  // Route messages and add to dApp request queue
  return dAppRequestQueue.add(walletInteraction)
}
```

### Message Type Flow Diagram

```mermaid
flowchart TD
    subgraph "Message Handling"
        MSG[Incoming Message] --> DISC{Message Discriminator}
        
        DISC -->|walletMessage| WM{Message Type}
        DISC -->|dAppRequest| DR[dApp Request]
        DISC -->|incomingWalletMessage| IWM[Wallet to dApp]
        DISC -->|ledgerResponse| LR[Ledger Response]
        
        WM -->|ledgerRequest| LRQ[Ledger Request]
        WM -->|extensionMessage| EM[Extension Message]
        WM -->|other| OM[Other Message]
        
        LRQ --> LRQH[Handle Ledger Request]
        EM --> EMH[Handle Extension Message]
        OM --> OMH[Add to incomingWalletMessageQueue]
        
        DR --> DRH[Add to dAppRequestQueue]
        IWM --> IWMH[Route to dApp]
        LR --> LRH[Add to extensionToWalletQueue]
    end
    

```

## Message Routing

- The `MessagesRouter` keeps track of message routing information:
  - Maps interaction IDs to tab IDs
  - Stores metadata like origin and network ID
  - Manages session routing between dApps and wallets
- The [`SessionRouter`](../src/chrome/offscreen/session-router.ts) handles mapping between session IDs and wallet public keys.

### Message Routing Diagram

```mermaid
graph TD
    MSG[Message] --> MR[MessagesRouter]
    MR --> ID{Interaction ID}
    ID --> TID[Tab ID]
    ID --> META[Metadata]
    
    SR[SessionRouter] --> SID{Session ID}
    SID --> WPK[Wallet Public Key]
    
    MR -.-> SR
    

```

## WebRTC Connection

The `WalletConnectionClient` maintains a WebRTC connection with the wallet:

```typescript
subscription.add(
  connectorClient.onMessage$.subscribe((message) => {
    messageClient.handleMessage(createMessage.walletMessage('wallet', message))
  })
)
```

## Connection State Management

The client monitors connection state and manages queues accordingly:

```typescript
subscription.add(
  connectorClient.connected$.subscribe((connected) => {
    if (connected) {
      extensionToWalletQueue.start()
      dAppRequestQueue.start()
    } else {
      extensionToWalletQueue.stop()
      dAppRequestQueue.stop()
    }
  })
)
```

### Connection State Diagram

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connected: connect()
    Connected --> Disconnected: disconnect()
    
    state Connected {
        [*] --> QueueActive
        QueueActive: extensionToWalletQueue.start()
        QueueActive: dAppRequestQueue.start()
    }
    
    state Disconnected {
        [*] --> QueuePaused
        QueuePaused: extensionToWalletQueue.stop()
        QueuePaused: dAppRequestQueue.stop()
    }
```

## Message Synchronization

A [`SyncClient`](../src/chrome/offscreen/wallet-connection/sync-client.ts) ensures message delivery and handles confirmations:
- Tracks confirmed interaction IDs
- Handles responses from the wallet
- Manages message lifecycle between dApp, extension, and wallet

### Synchronization Flow Diagram

```mermaid
sequenceDiagram
    participant dApp
    participant Extension
    participant SyncClient
    participant Wallet
    
    dApp->>Extension: Send Request
    Extension->>SyncClient: Track Request
    SyncClient->>Wallet: Forward Request
    Wallet-->>SyncClient: Confirm Receipt
    SyncClient-->>Extension: Update Request Status
    Wallet->>SyncClient: Send Response
    SyncClient->>Extension: Forward Response
    Extension->>dApp: Deliver Response
    SyncClient->>SyncClient: Remove Tracked Request
```

## Initialization

The offscreen page needs to retrieve data from the background page since it doesn't have direct access to `chrome.storage`. This is handled by [`offscreen-initialization-messages.ts`](../src/chrome/offscreen/helpers/offscreen-initialization-messages.ts), which retrieves:
- Connector Extension Options
- Session Router Data
- Wallet Connections

### Initialization Sequence Diagram

```mermaid
sequenceDiagram
    participant OS as Offscreen Page
    participant BG as Background Page
    participant CS as Chrome Storage
    
    OS->>BG: Request Extension Options
    BG->>CS: Get Extension Options
    CS-->>BG: Return Options
    BG-->>OS: Send Options
    
    OS->>BG: Request Session Router Data
    BG->>CS: Get Session Router Data
    CS-->>BG: Return Session Data
    BG-->>OS: Send Session Data
    
    OS->>BG: Request Wallet Connections
    BG->>CS: Get Wallet Connections
    CS-->>BG: Return Connections
    BG-->>OS: Send Connections
    
    OS->>OS: Initialize with Retrieved Data
```

## Complete Message Flow

1. A dApp sends a request through the extension
2. The offscreen page routes it through the appropriate `WalletConnectionClient`
3. The message is queued in the `dAppRequestQueue`
4. The message is sent to the wallet via WebRTC
5. The wallet processes the request and sends a response
6. The response is received through the WebRTC connection
7. The response is processed and routed back to the appropriate dApp

### Complete Flow Diagram

```mermaid
sequenceDiagram
    participant dApp
    participant CS as Content Script
    participant BG as Background Script
    participant OS as Offscreen Page
    participant WCC as WalletConnectionClient
    participant W as Wallet
    
    dApp->>CS: Send Request
    CS->>BG: Forward Request
    BG->>OS: Route Request
    OS->>WCC: Process Request
    WCC->>WCC: Add to dAppRequestQueue
    WCC->>W: Send via WebRTC
    W->>W: Process Request
    W->>WCC: Send Response via WebRTC
    WCC->>WCC: Add to incomingWalletMessageQueue
    WCC->>OS: Process Response
    OS->>BG: Route Response
    BG->>CS: Forward Response
    CS->>dApp: Deliver Response
```

This architecture ensures reliable communication between dApps and wallets while maintaining proper message routing and state management. 