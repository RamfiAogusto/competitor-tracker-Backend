// Jest setup file
// Este archivo se ejecuta antes de cada test

// Configurar timeout para tests
jest.setTimeout(10000)

// Mock de logger para tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}))

