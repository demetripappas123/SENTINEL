const React = require("react");
const { View } = require("react-native");
const mock = require("@gorhom/bottom-sheet/mock");

// Keep the library's imperative modal double, and render its native footer slot.
class ModalWithFooter extends mock.BottomSheetModal {
  render() {
    const { children, footerComponent: Footer } = this.props;
    return React.createElement(
      React.Fragment,
      null,
      children,
      Footer
        ? React.createElement(Footer, { animatedFooterPosition: { value: 0 } })
        : null,
    );
  }
}
module.exports = {
  ...mock,
  BottomSheetModal: ModalWithFooter,
  BottomSheetFooter: View,
};
