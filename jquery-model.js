$.fn.model = function () {
  function addViewModel(element) {

    var viewModelName = $(element).data('model');
    var viewModel = fc.prototypes()[viewModelName] == undefined
      ? fc.beans()[viewModelName] : new (fc.prototypes()[viewModelName]);

    fc.eventer(viewModel).on('postConstruct', function () {
      ko.applyBindings(viewModel, element);
    });
    fc.initBean(viewModel);
  }

  return this.each(function () {
    addViewModel(this);
  });
};