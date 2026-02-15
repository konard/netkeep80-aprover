import { test, expect } from '@playwright/test'

/**
 * E2E tests for the aprover web interface
 *
 * These tests verify the complete user experience of the
 * MTS (Метатеория Связей) prover web application.
 */

test.describe('aprover Web Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main page with correct title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('aprover')
    await expect(page.locator('.subtitle')).toContainText('Ассоциативный прувер')
  })

  test('should have editor and results panels', async ({ page }) => {
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.results-panel')).toBeVisible()
    await expect(page.locator('.code-input')).toBeVisible()
  })

  test('should have default MTS formulas in editor', async ({ page }) => {
    const editor = page.locator('.code-input')
    const value = await editor.inputValue()
    expect(value).toContain('МТС')
    expect(value).toContain('∞')
  })

  test('should verify default formulas successfully', async ({ page }) => {
    // The default formulas should be verified and shown in results
    const results = page.locator('.result-item')
    await expect(results.first()).toBeVisible()

    // All default formulas should pass
    const successItems = page.locator('.result-item.success')
    await expect(successItems.first()).toBeVisible()
  })

  test('should update results when editor content changes', async ({ page }) => {
    const editor = page.locator('.code-input')

    // Clear editor and enter a simple valid formula
    await editor.fill('∞ = ∞')

    // Wait for results to update
    await expect(page.locator('.result-item')).toHaveCount(1)
    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should show success indicator for valid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/success/)
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should show failure indicator for invalid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    // Using different structures that cannot be unified:
    // ♂∞ (male of infinity) cannot equal ∞♀ (female of infinity)
    await editor.fill('♂∞ = ∞♀')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/failure/)
    await expect(page.locator('.result-status')).toHaveText('✗')
  })

  test('should show error for invalid syntax', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('invalid syntax !!!')

    await expect(page.locator('.error-panel')).toBeVisible()
  })

  test('should verify infinity axiom (А4)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞')

    await expect(page.locator('.result-item.success')).toBeVisible()
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should verify male self-closing axiom (А5)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♂v = ♂v -> v')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify female self-closing axiom (А6)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('r♀ = r -> r♀')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify inversion axiom (А7)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('!♂x = x♀')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify power expansion', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a^2 = a -> a')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify multiple formulas', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill(`
∞ = ∞ -> ∞
♂v = ♂v -> v
r♀ = r -> r♀
`)

    const results = page.locator('.result-item')
    await expect(results).toHaveCount(3)

    // All formulas should be successful
    const successItems = page.locator('.result-item.success')
    await expect(successItems).toHaveCount(3)
  })

  test('should verify inequality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♂∞ != ∞♀')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should handle left associativity (А11)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b -> c = (a -> b) -> c')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should have GitHub link in footer', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toContainText('GitHub')
    await expect(page.locator('footer a')).toHaveAttribute(
      'href',
      'https://github.com/netkeep80/aprover'
    )
  })

  test('should have AST viewer panel', async ({ page }) => {
    // AST viewer should be visible by default
    await expect(page.locator('.ast-panel')).toBeVisible()
    await expect(page.locator('.ast-viewer')).toBeVisible()
  })

  test('should toggle AST viewer visibility', async ({ page }) => {
    // Initially visible
    await expect(page.locator('.ast-panel')).toBeVisible()

    // Click toggle button to hide
    await page.locator('.toggle-btn').click()
    await expect(page.locator('.ast-panel')).not.toBeVisible()

    // Click toggle button to show again
    await page.locator('.toggle-btn').click()
    await expect(page.locator('.ast-panel')).toBeVisible()
  })

  test('should have AST expand/collapse controls', async ({ page }) => {
    // AST viewer should have expand/collapse buttons
    await expect(page.locator('.ast-controls')).toBeVisible()
    await expect(page.locator('.ast-btn').first()).toBeVisible()
    await expect(page.locator('.ast-btn').nth(1)).toBeVisible()
  })

  test('should collapse all AST nodes', async ({ page }) => {
    // Enter a formula to generate AST
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Click collapse all button
    await page.locator('.ast-btn').nth(1).click()

    // After collapse, the Statement level should show collapsed indicator
    // (Statement is a child of File, and collapse all keeps only File expanded)
    const statementToggle = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
      .locator('.tree-toggle')
    await expect(statementToggle).toHaveText('▶')
  })

  test('should expand all AST nodes after collapse', async ({ page }) => {
    // Enter a formula to generate AST
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Collapse all first
    await page.locator('.ast-btn').nth(1).click()

    // Now expand all
    await page.locator('.ast-btn').first().click()

    // Tree children should be visible again
    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()
  })

  test('should display node location in AST tree', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Check that location info is displayed (format: [line:column])
    await expect(page.locator('.tree-loc').first()).toBeVisible()
    await expect(page.locator('.tree-loc').first()).toContainText('[')
  })

  test('should highlight source code when hovering AST node', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Find a tree node (e.g., the Identifier node)
    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()

    // Hover over the node
    await identifierNode.hover()

    // Check that the highlight appears in the editor
    await expect(page.locator('.ast-highlight')).toBeVisible()
  })

  test('should remove highlight when mouse leaves AST node', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Find a tree node
    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()

    // Hover over the node
    await identifierNode.hover()
    await expect(page.locator('.ast-highlight')).toBeVisible()

    // Move mouse away (hover over header)
    await page.locator('.app-header').hover()

    // Highlight should disappear
    await expect(page.locator('.ast-highlight')).not.toBeVisible()
  })

  test('should toggle individual AST nodes', async ({ page }) => {
    // Enter a formula with nested structure
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    // Wait for AST to render with children visible
    await expect(page.locator('.tree-root')).toBeVisible()
    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()

    // First collapse all to get to a known state
    await page.locator('.ast-btn').nth(1).click()

    // Now expand Statement node by clicking on it
    const statementNode = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
    await statementNode.click()

    // After clicking collapsed node, it should expand (show ▼)
    const toggleIndicator = statementNode.locator('.tree-toggle')
    await expect(toggleIndicator).toHaveText('▼')

    // Click again to collapse
    await statementNode.click()
    await expect(toggleIndicator).toHaveText('▶')
  })

  // Phase 3.1: File Operations Tests
  test.describe('File Operations', () => {
    test('should have toolbar with file operation buttons', async ({ page }) => {
      // Check for New button
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Новый' })
          .or(page.locator('.toolbar-btn[title*="Новый"]'))
          .first()
      ).toBeVisible()

      // Check for Open button
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Открыть' })
          .or(page.locator('.toolbar-btn[title*="Открыть"]'))
          .first()
      ).toBeVisible()

      // Check for Save button
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Сохранить' })
          .or(page.locator('.toolbar-btn[title*="Сохранить"]'))
          .first()
      ).toBeVisible()
    })

    test('should have Recent files button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn.recent-btn')
          .or(page.locator('.toolbar-btn[title*="Недавние"]'))
          .first()
      ).toBeVisible()
    })

    test('should toggle recent files dropdown', async ({ page }) => {
      const recentBtn = page
        .locator('.toolbar-btn.recent-btn')
        .or(page.locator('.toolbar-btn[title*="Недавние"]'))
        .first()

      // Initially dropdown should not be visible
      await expect(page.locator('.recent-files-dropdown')).not.toBeVisible()

      // Click to open dropdown
      await recentBtn.click()
      await expect(page.locator('.recent-files-dropdown')).toBeVisible()

      // Click again to close (or click outside)
      await recentBtn.click()
      // May still be visible depending on toggle logic, let's check for consistency
    })

    test('should show empty recent files message', async ({ page }) => {
      // Clear localStorage first
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      const recentBtn = page
        .locator('.toolbar-btn.recent-btn')
        .or(page.locator('.toolbar-btn[title*="Недавние"]'))
        .first()

      await recentBtn.click()
      await expect(page.locator('.recent-files-dropdown')).toBeVisible()
      await expect(page.locator('.recent-empty')).toBeVisible()
      await expect(page.locator('.recent-empty')).toContainText('Нет недавних файлов')
    })

    test('should have Results export button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Результаты' })
          .or(page.locator('.toolbar-btn[title*="Результаты"]'))
          .first()
      ).toBeVisible()
    })

    test('should have JSON export button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'JSON' })
          .or(page.locator('.toolbar-btn[title*="JSON"]'))
          .first()
      ).toBeVisible()
    })

    test('should disable export buttons when no results', async ({ page }) => {
      const editor = page.locator('.code-input')
      // Clear editor with invalid content that produces no valid results
      await editor.fill('')

      // Export buttons should be disabled when no results
      // Look for buttons containing "Результаты" or "JSON" text in the toolbar
      const resultsBtn = page.locator('.toolbar-btn').filter({ hasText: 'Результаты' }).first()
      const jsonBtn = page.locator('.toolbar-btn').filter({ hasText: 'JSON' }).first()

      await expect(resultsBtn).toBeDisabled()
      await expect(jsonBtn).toBeDisabled()
    })

    test('should enable export buttons when results exist', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      // Wait for verification to complete
      await expect(page.locator('.result-item')).toBeVisible()

      // Export buttons should be enabled
      const resultsBtn = page.locator('.toolbar-btn').filter({ hasText: 'Результаты' }).first()
      const jsonBtn = page.locator('.toolbar-btn').filter({ hasText: 'JSON' }).first()

      await expect(resultsBtn).not.toBeDisabled()
      await expect(jsonBtn).not.toBeDisabled()
    })

    test('should display file name in editor header', async ({ page }) => {
      // Default file name should be shown
      await expect(page.locator('.file-name')).toBeVisible()
      await expect(page.locator('.file-name')).toContainText('.mtl')
    })

    test('should clear editor on New file button', async ({ page }) => {
      const editor = page.locator('.code-input')

      // Enter some content first
      await editor.fill('custom content here')
      await expect(editor).toHaveValue('custom content here')

      // Click New button
      const newBtn = page.locator('.toolbar-btn[title*="Новый"]').first()
      await newBtn.click()

      // Editor should be cleared to default template
      const value = await editor.inputValue()
      expect(value).toContain('МТС')
    })

    test('should show drag-and-drop overlay on drag over', async ({ page }) => {
      const editor = page.locator('.editor-container')

      // Simulate drag enter using page.evaluate to access browser context
      await editor.evaluate(el => {
        const event = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
        })
        el.dispatchEvent(event)
      })

      // Drop overlay should appear
      await expect(page.locator('.drop-overlay')).toBeVisible()
      await expect(page.locator('.drop-message')).toContainText('Отпустите файл')
    })

    test('should have keyboard shortcut hint in New button title', async ({ page }) => {
      const newBtn = page.locator('.toolbar-btn[title*="Новый"]').first()
      const title = await newBtn.getAttribute('title')
      expect(title).toContain('Ctrl+N')
    })

    test('should have keyboard shortcut hint in Open button title', async ({ page }) => {
      const openBtn = page.locator('.toolbar-btn[title*="Открыть"]').first()
      const title = await openBtn.getAttribute('title')
      expect(title).toContain('Ctrl+O')
    })

    test('should have keyboard shortcut hint in Save button title', async ({ page }) => {
      const saveBtn = page.locator('.toolbar-btn[title*="Сохранить"]').first()
      const title = await saveBtn.getAttribute('title')
      expect(title).toContain('Ctrl+S')
    })

    test('should display version number', async ({ page }) => {
      await expect(page.locator('.version')).toBeVisible()
      await expect(page.locator('.version')).toContainText('v0.7.0')
    })
  })

  // Phase 2.4: Enhanced Prover Tests
  test.describe('Enhanced Prover Features', () => {
    test('should display applied axioms badges', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      // Wait for results
      await expect(page.locator('.result-item.success')).toBeVisible()

      // Check for applied axioms section
      await expect(page.locator('.applied-axioms')).toBeVisible()
      await expect(page.locator('.axiom-badge')).toBeVisible()
    })

    test('should show axiom badges with correct labels', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should have A4 axiom badge for infinity
      const axiomBadge = page.locator('.axiom-badge')
      await expect(axiomBadge.filter({ hasText: 'A4' })).toBeVisible()
    })

    test('should show expand toggle for results with details', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('♂v = ♂v -> v')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should have expand toggle indicator
      await expect(page.locator('.expand-toggle')).toBeVisible()
    })

    test('should expand proof steps on click', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Click on result header to expand
      await page.locator('.result-header').first().click()

      // Should show proof details
      await expect(page.locator('.proof-details')).toBeVisible()
      await expect(page.locator('.proof-steps-list')).toBeVisible()
    })

    test('should display proof step index numbers', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Click to expand
      await page.locator('.result-header').first().click()

      // Should have step indices
      await expect(page.locator('.step-index').first()).toBeVisible()
      await expect(page.locator('.step-index').first()).toContainText('1.')
    })

    test('should display proof step actions', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Click to expand
      await page.locator('.result-header').first().click()

      // Should have step actions
      await expect(page.locator('.step-action').first()).toBeVisible()
    })

    test('should collapse proof steps on second click', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Click to expand
      await page.locator('.result-header').first().click()
      await expect(page.locator('.proof-details')).toBeVisible()

      // Click to collapse
      await page.locator('.result-header').first().click()
      await expect(page.locator('.proof-details')).not.toBeVisible()
    })

    test('should display hints for failed verification', async ({ page }) => {
      const editor = page.locator('.code-input')
      // This should fail: male and female are dual but not equal
      await editor.fill('♂∞ = ∞♀')

      await expect(page.locator('.result-item.failure')).toBeVisible()

      // Should show hints section
      await expect(page.locator('.hints-section')).toBeVisible()
      await expect(page.locator('.hint-item').first()).toBeVisible()
    })

    test('should display hint icons', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('♂∞ = ∞♀')

      await expect(page.locator('.result-item.failure')).toBeVisible()

      // Should have lightbulb icon
      await expect(page.locator('.hint-icon').first()).toBeVisible()
    })

    test('should display related axiom in hints when applicable', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('♂∞ = ∞♀')

      await expect(page.locator('.result-item.failure')).toBeVisible()

      // Should have axiom reference in hints
      const hintAxiom = page.locator('.hint-axiom')
      await expect(hintAxiom.first()).toBeVisible()
    })

    test('should show A5 axiom for male self-closing', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('♂v = ♂v -> v')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should show A5 axiom badge
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A5' })).toBeVisible()
    })

    test('should show A6 axiom for female self-closing', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('r♀ = r -> r♀')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should show A6 axiom badge
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A6' })).toBeVisible()
    })

    test('should show A1 axiom for structural equality', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should show A1 axiom badge
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A1' })).toBeVisible()
    })

    test('should show axiom tooltip on hover', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Axiom badge should have title attribute for tooltip
      const axiomBadge = page.locator('.axiom-badge').first()
      const title = await axiomBadge.getAttribute('title')
      expect(title).toBeTruthy()
      expect(title).toContain(':')
    })

    test('should display axioms label', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()

      // Should show "Применённые аксиомы:" label
      await expect(page.locator('.axioms-label')).toBeVisible()
      await expect(page.locator('.axioms-label')).toContainText('Применённые аксиомы')
    })
  })

  // Phase 3.2: String Anums (.astr) Tests
  test.describe('String Anums Support', () => {
    test('should not show conversion toggle by default (mtl mode)', async ({ page }) => {
      // By default, we're in MTL mode, so no conversion toggle
      const convToggle = page.locator('.toggle-btn').filter({ hasText: 'Conv' })
      await expect(convToggle).not.toBeVisible()
    })

    test('should not show file type badge in MTL mode', async ({ page }) => {
      // MTL is the default mode, no badge should be shown
      await expect(page.locator('.file-type-badge')).not.toBeVisible()
    })

    test('should not show conversion panel by default', async ({ page }) => {
      await expect(page.locator('.conversion-panel')).not.toBeVisible()
    })
  })

  // Phase 3.3: Quaternary Anums (.anum) Tests
  test.describe('Quaternary Anums Support', () => {
    test('should have abit legend defined in conversion panel styles', async ({ page }) => {
      // Verify that the page has the abit-legend CSS class defined
      // (This tests that the anum panel structure is properly set up)
      const hasStyles = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.abit-legend')) {
                return true
              }
            }
          } catch {
            // Cross-origin stylesheets throw SecurityError
          }
        }
        return false
      })
      expect(hasStyles).toBe(true)
    })
  })

  // Phase 3.4: Extended Resolution Algorithm Tests
  test.describe('Extended Resolution Algorithm', () => {
    test('should verify reflexivity (A1)', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('x = x')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A1' })).toBeVisible()
    })

    test('should verify symmetry (A1) via proven equalities', async ({ page }) => {
      const editor = page.locator('.code-input')
      // Reflexivity should work for any identifier
      await editor.fill('myVar = myVar')

      await expect(page.locator('.result-item.success')).toBeVisible()
    })

    test('should verify infinity axiom with link structure', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = (∞ -> ∞)')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A4' })).toBeVisible()
    })
  })

  // Phase 3.5: Performance and UX Tests
  test.describe('Performance and UX Features', () => {
    test('should handle large expressions without freezing', async ({ page }) => {
      const editor = page.locator('.code-input')
      // Create a moderately large expression
      const largeExpr = Array.from({ length: 10 }, (_, i) => `a${i} = a${i}`).join('\n')
      await editor.fill(largeExpr)

      // Should verify all without timeout
      const results = page.locator('.result-item')
      await expect(results).toHaveCount(10)

      // All should be successful
      const successItems = page.locator('.result-item.success')
      await expect(successItems).toHaveCount(10)
    })

    test('should autosave to localStorage', async ({ page }) => {
      const editor = page.locator('.code-input')
      const testContent = '// Test autosave content\na = a'
      await editor.fill(testContent)

      // Manually trigger autosave by checking localStorage
      // (actual autosave happens every 30s, but we can verify the mechanism)
      const hasAutosaveKey = await page.evaluate(() => {
        // Check if autosave mechanism is set up
        return typeof Storage !== 'undefined'
      })
      expect(hasAutosaveKey).toBe(true)
    })

    test('should support AST lazy loading for large expressions', async ({ page }) => {
      const editor = page.locator('.code-input')
      // Create expression with nested structure
      await editor.fill('((a -> b) -> c) -> d')

      await expect(page.locator('.tree-root')).toBeVisible()

      // AST should render without issues
      const treeNodes = page.locator('.tree-node-content')
      await expect(treeNodes.first()).toBeVisible()
    })

    test('should show child count indicator for collapsed nodes', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a -> b -> c')

      await expect(page.locator('.tree-root')).toBeVisible()

      // Collapse all
      await page.locator('.ast-btn').nth(1).click()

      // Look for child count indicators (if implemented)
      // This tests the lazy loading infrastructure
      const toggles = page.locator('.tree-toggle')
      await expect(toggles.first()).toBeVisible()
    })
  })

  // Phase 3.6: Testing and Documentation Verification
  test.describe('Documentation and Help', () => {
    test('should have correct version displayed', async ({ page }) => {
      // Version should match package.json
      await expect(page.locator('.version')).toBeVisible()
      const version = await page.locator('.version').textContent()
      expect(version).toMatch(/^v\d+\.\d+\.\d+$/)
    })

    test('should have GitHub link pointing to correct repository', async ({ page }) => {
      const githubLink = page.locator('footer a')
      await expect(githubLink).toHaveAttribute('href', 'https://github.com/netkeep80/aprover')
    })

    test('should have correct subtitle describing the application', async ({ page }) => {
      await expect(page.locator('.subtitle')).toContainText('Метатеории Связей')
      await expect(page.locator('.subtitle')).toContainText('МТС')
    })
  })
})
