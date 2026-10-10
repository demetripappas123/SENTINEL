import XCTest

final class SentinelScreenshots: XCTestCase {
  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
  func button(_ app: XCUIApplication, _ prefix: String) -> XCUIElement {
    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
  }
  func tapWhenReady(_ element: XCUIElement) {
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hittable == true"), object: element)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 5), .completed)
    element.tap()
  }
  func testLargeTextControls() {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.sentinel.inspections")
    app.launch()
    XCTAssertTrue(app.buttons["Review queue"].waitForExistence(timeout: 20))
    capture("LargeTextAttention")
    app.buttons["Choose mission dates"].tap()
    XCTAssertTrue(app.textFields["Start date"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["All dates"].isHittable)
    app.buttons["All dates"].tap()
    button(app, "Missions tab,").tap()
    XCTAssertTrue(app.buttons["Inspect M027"].waitForExistence(timeout: 5))
    capture("LargeTextMissions")
    app.buttons["Inspect M027"].tap()
    XCTAssertTrue(app.buttons["Close"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["Close"].isHittable)
    app.buttons["Close"].tap()
    tapWhenReady(button(app, "Facility tab,"))
    XCTAssertTrue(app.buttons["Map waypoint WP05 Pipe Gallery"].waitForExistence(timeout: 5))
    capture("LargeTextFacility")
    app.buttons["Choose floor"].tap()
    XCTAssertTrue(app.buttons["Floor 1"].isHittable)
    app.buttons["Floor 1"].tap()
    button(app, "Attention tab,").tap()
    let queue = app.buttons["Review queue"]
    for _ in 0..<8 {
      if queue.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(queue.isHittable)
    queue.tap()
    XCTAssertTrue(app.buttons["Mark reviewed"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["Mark reviewed"].isHittable)
    capture("LargeTextEvidence")
    XCTAssertTrue(app.buttons["Close"].isHittable)
    app.buttons["Close"].tap()
  }
  func testScreensAndReview() {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.sentinel.inspections")
    app.launch()
    let queue = app.buttons["Review queue"]
    XCTAssertTrue(queue.waitForExistence(timeout: 20))
    capture("Attention")
    app.buttons["Switch to dark appearance"].tap()
    capture("DarkAttention")
    app.buttons["Switch to light appearance"].tap()
    app.buttons["Choose mission dates"].tap()
    XCTAssertTrue(app.textFields["Start date"].waitForExistence(timeout: 5))
    app.textFields["Start date"].tap()
    capture("DateKeyboard")
    XCTAssertTrue(app.buttons["All dates"].isHittable)
    app.buttons["All dates"].tap()
    button(app, "Missions tab,").tap()
    XCTAssertTrue(app.buttons["Inspect M027"].waitForExistence(timeout: 5))
    capture("Missions")
    app.buttons["Inspect M015"].tap()
    XCTAssertTrue(app.staticTexts["7 / 10 successful"].waitForExistence(timeout: 5))
    capture("MissionEvidence")
    app.buttons["Close"].tap()
    tapWhenReady(button(app, "Facility tab,"))
    XCTAssertTrue(app.buttons["Map waypoint WP05 Pipe Gallery"].waitForExistence(timeout: 5))
    capture("Facility")
    app.buttons["Map waypoint WP12 Heat Exchanger Area"].tap()
    XCTAssertTrue(app.staticTexts["Heat Exchanger Area"].waitForExistence(timeout: 5))
    app.buttons["Choose floor"].tap()
    app.buttons["Floor 1"].tap()
    XCTAssertFalse(app.buttons["Map waypoint WP12 Heat Exchanger Area"].exists)
    button(app, "Attention tab,").tap()
    queue.tap()
    let review = app.buttons["Mark reviewed"]
    XCTAssertTrue(review.waitForExistence(timeout: 5))
    XCTAssertTrue(review.isHittable)
    capture("Evidence")
    app.swipeUp()
    XCTAssertTrue(app.staticTexts["Readings"].waitForExistence(timeout: 5))
    capture("ExpandedEvidence")
    review.tap()
    XCTAssertTrue(button(app, "Attention tab, 14").waitForExistence(timeout: 5))
    app.terminate()
    app.launch()
    XCTAssertTrue(button(app, "Attention tab, 14").waitForExistence(timeout: 20))
    app.buttons["Reviewed"].tap()
    button(app, "Inspect Abnormal temperature").tap()
    let undo = app.buttons["Undo review"]
    XCTAssertTrue(undo.waitForExistence(timeout: 5))
    undo.tap()
    XCTAssertTrue(button(app, "Attention tab, 15").waitForExistence(timeout: 5))
    app.buttons["To review"].tap()
    queue.tap()
    XCTAssertTrue(app.buttons["Close"].waitForExistence(timeout: 5))
    app.buttons["Close"].tap()
    XCTAssertTrue(queue.waitForExistence(timeout: 5))
    queue.tap()
    XCTAssertTrue(app.buttons["Mark reviewed"].waitForExistence(timeout: 5))
    let handle = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.31))
    let below = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.9))
    handle.press(forDuration: 0.1, thenDragTo: below)
    tapWhenReady(queue)
    XCTAssertTrue(app.buttons["Mark reviewed"].waitForExistence(timeout: 5))
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.18)).tap()
    let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.buttons["Close"])
    XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
    XCTAssertTrue(queue.isHittable)
  }
}
