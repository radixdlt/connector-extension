export const getDataLength = (data: string) =>
  `00${Math.floor(data.length / 2).toString(16)}`.slice(-2)
