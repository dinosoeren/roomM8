var currentStep = 0;
var lastStep = 0;
var isHash = window.location.hash === "#success";
var tagsInputInitialized = false;
var isModalReady = true;

$(document).ready(function(){
    lastStep = $('#registration-form fieldset:not(#confirmDelete)').length-1;

    // Focus on first input and load city data when modal is opened.
    $('#registerModal').on('shown.bs.modal', function() {
        $('#name').focus();
        if(!tagsInputInitialized && $('#pref-locations').length > 0) {
            readAndInitCityTags();
            tagsInputInitialized = true;
        }
    });
    // Show modal on page load if '#success' is in url.
    if(isHash) {
        $('#registerModal').modal("show");
    }
    // Initialize 'important factors' sliders.
    $(".slider").slider({
        ticks: [1,2,3],
        min: 1,
        max: 3,
        step: 1,
        tooltip: 'hide'
    });

    // Init registration form stuff.
    $('[data-toggle="tooltip"]').tooltip();
    $('.error-message').hide();
    $('.success-message').hide();
    $('#registration-form .btn-register').hide();
    $('#registration-form .btn-previous').hide();
    $('#registration-form fieldset#f0').fadeIn('slow');
    $('#registration-form .btn-register').on('click', function() {
        $('#registration-form').submit();
    });
    $('#registration-form .form-control').on('focus', function () {
        $(this).removeClass('input-error');
    });
    if($("#editText").length > 0)
        $("#continueText").hide();
    // Handle 'delete profile' button click.
    $("#registration-form .btn-delete").on('click', function() {
        if(!isModalReady)
            return;
        isModalReady = false;
        if(currentStep == -1) { // already in confirm dialog
            // Make sure they check the agree box.
            if(!$("#agreeToDelete").is(":checked")) {
                showErrorMessage("Please indicate that you understand the consequences.");
                isModalReady = true;
                return;
            }
            // Delete user profile!
            console.log("Deleting user profile!");
            $('#registration-form').attr('action', "/deleteMe").submit();
            isModalReady = true;
            return;
        }
        var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        currentStep = -1;
        parent_fieldset.fadeOut(200, function () {
            $('#registration-form fieldset#confirmDelete').fadeIn(200, function() {
                isModalReady = true;
                inConfirmDeleteDialog = true;
            });
            evalBtns();
        });
    });
    // Handle 'Continue' button click.
    $('#registration-form .btn-next').on('click', function () {
        if(!isModalReady)
            return;
        if(currentStep >= lastStep)
            return;
        isModalReady = false;
        var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        var next_step = true;
        $(parent_fieldset).find('.form-control:not(.optional)').each(function () {
            var tagsInput = $(this).prev('.bootstrap-tagsinput');
            if (!isFieldValid(this)) {
                if(tagsInput.length > 0)
                    tagsInput.addClass('input-error');
                else
                    $(this).addClass('input-error');
                next_step = false;
            } else {
                if(tagsInput.length > 0)
                    tagsInput.removeClass('input-error');
                else
                    $(this).removeClass('input-error');
            }
        });
        if (next_step) {
            if(currentStep === 1) {
                if(userHasPlace()) {
                    // Skip step 2 if the user has a place already.
                    currentStep++;
                    // Also hide irrelevant factors in step 4.
                    $(".no-place").hide();
                } else {
                    // Otherwise, show all factors in step 4.
                    $(".no-place").show();
                }
            } else if(currentStep == 2) {
                // Skip step 3 if the user does not have a place.
                currentStep++;
            }
            currentStep++;
            parent_fieldset.fadeOut(200, function () {
                $('#registration-form fieldset#f'+currentStep).fadeIn(200, function() {
                    isModalReady = true;
                });
                evalBtns();
            });
        } else {
            showErrorMessage();
            isModalReady = true;
        }
    });
    // Handle 'Back' button click.
    $('#registration-form .btn-previous').on('click', function () {
        if(!isModalReady)
            return;
        if(currentStep == 0)
            return;
        isModalReady = false;
        var parent_fieldset;
        if(currentStep === -1) {
            $('#agreeToDelete').prop('checked', false); // uncheck agree box
            parent_fieldset = $('#registration-form fieldset#confirmDelete');
            currentStep = 1; // go back to step 0 after this.
        } else {
            parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        }
        $(parent_fieldset).fadeOut(200, function () {
            if(currentStep === 3 || (currentStep === 4 && !userHasPlace())) {
                // Go back to step 1 from step 3 if the user already has a place.
                // Go back to step 2 from step 4 if the user does not have a place.
                currentStep--;
            }
            currentStep--;
            $('#registration-form fieldset#f'+currentStep).fadeIn(200, function() {
                isModalReady = true;
            });
            evalBtns();
        });
    });

    // Handle secret code events.
    $('#btn-check-code').on('click', function() {
        checkSecretKey();
    });
    $('#secretKey').keypress(function (e) {
        if (e.which == 13) { // 'Enter' key.
            checkSecretKey();
            return false;
        }
    });

    // Handle roommate search box events.
    $('#roommateSearchBox').on('focus', function() {
        $(this).parent('.input-group').addClass('focus');
    });
    $('#roommateSearchBox').on('blur', function() {
        $(this).parent('.input-group').removeClass('focus');
    });
});

function readAndInitCityTags() {
    // Read cities json file and initialize cities input.
    $.getJSON('data/citynames.json', function(data) {
        var count = 0;
        async.map(data, function(cityname, callback) {
            count++;
            var newObj = { name: cityname };
            if(count % 100 == 0) {
                setTimeout(function() {
                    callback(null, newObj);
                }, 500);
            } else {
                callback(null, newObj);
            }
        }, function(err, results) {
            // Results is now an array of objects.
            initializeCityTagsInput(results);
        });
    });
}
function initializeCityTagsInput(data) {
    // Get typeahead data for Locations input.
    var citynames = new Bloodhound({
        local: data,
        datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
        queryTokenizer: Bloodhound.tokenizers.whitespace
    });
    citynames.initialize();
    // Initialize Locations input.
    $('#pref-locations').tagsinput({
        maxTags: 10,
        maxChars: 20,
        trimValue: true,
        tagClass: 'label label-success',
        confirmKeys: [13, 44],
        typeaheadjs: {
            name: 'citynames',
            displayKey: 'name',
            valueKey: 'name',
            sufficient: 8,
            source: citynames.ttAdapter()
        },
        freeInput: true
    });
    $('.bootstrap-tagsinput input').on('focus', function () {
        $('.bootstrap-tagsinput').removeClass('input-error');
    });
}

// Check if a particular input field has a valid value.
function isFieldValid(ele) {
    var supportsValidate = typeof ele.willValidate !== "undefined";
    var value = $(ele).val();
    return value !== "" && value !== null && value.length !== 0 &&
            (!supportsValidate || !ele.willValidate || ele.checkValidity());
}
// Check if user has indicated they own a place.
function userHasPlace() {
    return $("#has-place").length > 0 && $("#has-place").is(':checked');
}
// Hide/show previous and next buttons based on step.
function evalBtns() {
    if(currentStep === -1) {
        // Delete button was pressed. Take user to confirmation dialog.
        $('#registration-form .btn-next').hide();
        $('#registration-form .btn-previous').show();
        return;
    }
    if(currentStep === 0) {
        $('#registration-form .btn-previous').hide();
        if($("#editText").length > 0) {
            $("#registration-form .btn-delete").show();
            $("#editText").show();
            $("#continueText").hide();
        }
    } else {
        $('#registration-form .btn-previous').show();
        if($("#editText").length > 0) {
            $("#registration-form .btn-delete").hide();
            $("#editText").hide();
            $("#continueText").show();
        }
    }
    if(currentStep >= lastStep) {
        $('#registration-form .btn-next').hide();
        $('#registration-form .btn-register').show();
    } else {
        $('#registration-form .btn-register').hide();
        $('#registration-form .btn-next').show();
    }
}
// Show an error message in the registration form.
function showErrorMessage(msg) {
    if(msg) {
        $('.error-message .msg').text(msg);
    } else {
        $('.error-message .msg').text($('.error-message').attr("data-message"));
    }
    $('.error-message').slideDown(200);
    $('.error-message').delay(3000).slideUp(200);
}
// Show a success message in the registration form.
function showSuccessMessage(msg) {
    if(msg) {
        $('.success-message .msg').text(msg);
    } else {
        $('.success-message .msg').text($('.success-message').attr("data-message"));
    }
    $('.success-message').slideDown(200);
    $('.success-message').delay(3000).slideUp(200);
}

// Check if the secret code the user entered is valid.
function checkSecretKey() {
    if($("#secretKey").val() === "")
        return;
    $.post("/api/access", {key: $("#secretKey").val()}).done(function(data) {
        if (data.error) {
            showErrorMessage("Error: "+data.error);
        } else {
            showSuccessMessage("Success! You entered the correct code.");
            $("#code-stuff").slideUp();
        }
    }).fail(function() {
        showErrorMessage("An unexpected error occurred. Please try again.");
    });
}