import { Crypto } from '@peculiar/webcrypto'
import { chrome } from 'jest-chrome'

global.crypto = new Crypto()
global.chrome = chrome
