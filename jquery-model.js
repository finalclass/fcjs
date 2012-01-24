$.fn.model = function () {
  function addViewModel(element) {
    var viewModelName = $(element).data('model');
    var viewModel = new window[viewModelName]();
    fc.eventer(viewModel).on('postConstruct', function () {
      ko.applyBindings(viewModel, element);
    });
    fc.initBean(viewModel);
  }

  return this.each(function () {
    addViewModel(this);
  });
};