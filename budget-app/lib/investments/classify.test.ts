import { describe, it, expect } from 'vitest'
import { classifyTransaction } from './classify'

describe('classifyTransaction', () => {
  it('classifies money coming in as a contribution', () => {
    expect(classifyTransaction('ACH_RECEIPT')).toBe('contribution')
    expect(classifyTransaction('CASH_RECEIPT')).toBe('contribution')
    expect(classifyTransaction('WIRE_IN')).toBe('contribution')
  })

  it('classifies money going out as a withdrawal', () => {
    expect(classifyTransaction('ACH_DISBURSEMENT')).toBe('withdrawal')
    expect(classifyTransaction('CASH_DISBURSEMENT')).toBe('withdrawal')
    expect(classifyTransaction('WIRE_OUT')).toBe('withdrawal')
  })

  it('classifies dividends and interest together', () => {
    expect(classifyTransaction('DIVIDEND_OR_INTEREST')).toBe('dividend_or_interest')
  })

  it('classifies buys/sells as trades', () => {
    expect(classifyTransaction('TRADE')).toBe('trade')
    expect(classifyTransaction('RECEIVE_AND_DELIVER')).toBe('trade')
  })

  it('classifies internal movements as transfers', () => {
    expect(classifyTransaction('JOURNAL')).toBe('transfer')
    expect(classifyTransaction('ELECTRONIC_FUND')).toBe('transfer')
  })

  it('falls back to other for an unrecognized type instead of throwing', () => {
    expect(classifyTransaction('SOMETHING_NEW_SCHWAB_ADDED')).toBe('other')
  })
})
