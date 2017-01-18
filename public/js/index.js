var currentStep = 0;
var lastStep = 0;
var isHash = window.location.hash === "#success";
var tagsInputInitialized = false;
var isModalReady = true;

$(document).ready(function(){
    lastStep = $('#registration-form fieldset:not(#confirmDelete)').length-1;

    // Load city data when modal is opened.
    $('#registerModal').on('shown.bs.modal', function() {
        hideErrorMessage();
        hideSuccessMessage();
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
        if(!areAllFieldInputsValid()) {
            showErrorMessage();
            return;
        }
        $('#registration-form').submit();
    });
    $('.regRequired,.form-control').on('focus', function () {
        $(this).removeClass('input-error');
    });
    if($("#editText").length > 0)
        $("#continueText").hide();
    // Handle 'Cancel' button click.
    $("#registration-form .btn-cancel").on('click', function() {
        if(!isModalReady)
            return;
        isModalReady = false;
        var parent_fieldset;
        if(currentStep === -1) {
            $('#agreeToDelete').prop('checked', false); // Uncheck agree box.
            parent_fieldset = $('#registration-form fieldset#confirmDelete');
        } else {
            parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        }
        currentStep = 0; // Go back to step 0 after this.
        parent_fieldset.fadeOut(200, function () {
            $('#registration-form fieldset#f'+currentStep).show();
            $('#registration-form')[0].reset(); // Reset the form to default values.
            $('#registration-form .regRequired, #registration-form .form-control').each(function () {
                $(this).removeClass('input-error'); // Remove input error classes.
            });
            evalBtns();
            isModalReady = true;
        });
    });
    // Handle 'Delete Profile' button click.
    $("#registration-form .btn-delete").on('click', function() {
        if(!isModalReady)
            return;
        isModalReady = false;
        if(currentStep == -1) { // already in confirm dialog
            // Make sure they check the agree box.
            if(!$("#agreeToDelete").is(":checked")) {
                $("#agreeToDelete").addClass('input-error');
                showErrorMessage("Please indicate that you understand the consequences.");
                isModalReady = true;
                return;
            }
            $("#agreeToDelete").removeClass('input-error');
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
        if (areAllFieldInputsValid()) {
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
                hideErrorMessage();
                hideSuccessMessage();
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
            hideErrorMessage();
            hideSuccessMessage();
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

    // Handle message form stuff.
    // Change title and input when message modal is opened.
    $('#messageModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget);
        var recipientName = button.data('name');
        var recipientID = button.data('id');
        var modal = $(this);
        // Hide messages.
        hideSuccessMessage('#message-form');
        hideErrorMessage('#message-form');
        // Show fieldset.
        $('#fieldsetMessage').show();
        $('#message-form .btn-send').show();
        $('#message-form .btn-cancel').text("Cancel");
        // Set title.
        modal.find('.modal-title').text('New message to ' + recipientName);
        // Reset inputs if this is a different user.
        if($('#messageSubject').val() === "" || $('#recipientID').val() != recipientID) {
            $('#messageSubject').val($('#messageSubject').data('default'));
            $('#messageContent').val('');
            $('#fieldsetMessage .regRequired, #fieldsetMessage .form-control').each(function () {
                $(this).removeClass('input-error'); // Remove input error classes.
            });
        }
        $('#recipientID').val(recipientID);
        $('#recipientName').val(recipientName);
        $('.recipientName').text(recipientName);
        // Uncheck checkboxes.
        modal.find("[type='checkbox']").prop('checked', false);
    });
    // Handle message send button click.
    var sendingMessage = false;
    $('#message-form .btn-send').on('click', function() {
        if(sendingMessage)
            return;
        if(!areAllFieldInputsValid('#fieldsetMessage')) {
            showErrorMessage(null, '#message-form');
            return;
        }
        sendingMessage = true;
        $('#fieldsetMessage').slideUp(200);
        startSpinner("#messageModal .modal-body");
        // Send message to server.
        $.post("/message", {
            recipientID: $("#recipientID").val(),
            subject: $('#messageSubject').val(),
            message: $('#messageContent').val()
        }).done(function(data) {
            stopSpinner();
            sendingMessage = false;
            if (data.error) {
                showErrorMessage("Error: "+data.error, '#message-form');
                $('#fieldsetMessage').stop().slideDown(200);
            } else {
                showSuccessMessage("Message sent successfully!", '#message-form', true);
                // Reset the form to default state.
                $('#message-form')[0].reset();
                $('#message-form .btn-send').hide();
                $('#message-form .btn-cancel').text("Done");
                // Disable the message button in profile card.
                var button = $(".profile-card button[data-id='"+$("#recipientID").val()+"']").first();
                button.prop('disabled', true);
                var glyphicon = button.find('.glyphicon');
                glyphicon.removeClass('glyphicon-send');
                glyphicon.addClass('glyphicon-ok');
                button.find('.btn-text').text("Message Sent");
            }
        }).fail(function() {
            stopSpinner();
            sendingMessage = false;
            showErrorMessage("An unexpected error occurred. Please try again.", '#message-form');
            $('#fieldsetMessage').stop().slideDown(200);
        });
    });

    // Handle advanced search stuff.
    $("#advanced-search .filter-group").each(function() {
        var inputField = $(this).find('.form-control');
        var checkbox = $(this).find("input[type='checkbox']");
        checkbox.change(function() {
            if($(this).is(":checked")) {
                inputField.prop('disabled', false);
            } else {
                inputField.prop('disabled', true);
            }
        });
    });

    $("#registerModal .profile-card .desc").each(function() {
        $(this).find('span').text($(this).attr('data-desc').substring(0,100)+"...");
    });
    $("#dateToFormat").each(function() {
        $(this).text(formatDateNumToWords($(this).text()));
    });
    $("#factorsToSort").each(function() {
        $(this).text(selectTopFactors($(this).data('factors')));
    });
});

// Capitalize words.
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
String.prototype.capitalizeAll = function() {
    var words = this.split(' ');
    for(var i=0; i<words.length; i++) {
        words[i] = words[i].capitalize();
    }
    return words.join(' ');
};
// Handle profile card description 'Read more' click event.
function toggleReadMore(event, ele) {
    var descContainer = $(ele).parent('.desc');
    if($(ele).is('.more')) {
        $(ele).removeClass("more");
        $(ele).text("Less");
        descContainer.find('span').text(descContainer.attr('data-desc'));
    } else {
        $(ele).addClass("more");
        $(ele).text("More");
        descContainer.find('span').text(descContainer.attr('data-desc').substring(0,100)+"...");
    }
    event.preventDefault();
}
// Format date. Convert from '2017-09' to 'September 2017'
function formatDateNumToWords(dateString) {
    var options = {
        year: "numeric", month: "long"
    };
    return new Date(dateString+"-02").toLocaleDateString("en-US", options);
};
var factorsDict = {
    location: "Location",
    residenceType: "Residence type",
    ownBedroom: "Own bedroom",
    ownBathroom: "Own bathroom",
    commuteTime: "Short commute time",
    cleanliness: "Cleanliness",
    quietTime: "Quiet time",
    substanceFree: "Substance-free",
    sameGender: "Same gender",
    sameAge: "Same age",
    sameField: "Same field"
};
// Get the top 3 most important factors from array.
function selectTopFactors(factors) {
    var sorted = [];
    for(var factor in factors) {
        if(!factorsDict.hasOwnProperty(factor))
            continue;
        sorted.push({ 
            factor: factor, 
            rating: factors[factor] 
        });
    }
    sorted.sort(function(a, b) {
        return b.rating - a.rating;
    });
    var mostImportant = [];
    for(var i=0; i<3; i++) {
        mostImportant.push(factorsDict[sorted[i].factor]);
    }
    return mostImportant.join(", ");
};

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

function areAllFieldInputsValid(fieldsetSelector) {
    var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
    if (fieldsetSelector) {
        parent_fieldset = $(fieldsetSelector);
    }
    var next_step = true;
    $(parent_fieldset).find('.regRequired,.form-control:not(.optional)').each(function () {
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
    return next_step;
}
// Check if a particular input field has a valid value.
function isFieldValid(ele) {
    var supportsValidate = typeof ele.willValidate !== "undefined";
    if($(ele).is("[type='checkbox']")) {
        return $(ele).is(":checked");
    }
    var value = $(ele).val();
    // Make sure it's stripped of html.
    var stripped = $('<p>'+value+'</p>').text();
    return value !== "" && value !== null && value.length !== 0 && value == stripped &&
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
// Show an error message in the form.
function showErrorMessage(msg, formSelector, persistent=false) {
    if(!formSelector)
        formSelector = "#registerModal";
    if(msg) {
        $(formSelector+' .error-message .msg').text(msg);
    } else {
        $(formSelector+' .error-message .msg').text(
            $(formSelector+' .error-message').attr("data-message")
        );
    }
    $(formSelector+' .error-message').stop().slideDown(200);
    if(!persistent)
        $(formSelector+' .error-message').delay(3000).slideUp(200);
}
// Hide error message immediately.
function hideErrorMessage(formSelector) {
    if(!formSelector)
        formSelector = "#registerModal";
    $(formSelector+' .error-message').stop().hide();
}
// Show a success message in the form.
function showSuccessMessage(msg, formSelector, persistent=false) {
    if(!formSelector)
        formSelector = "#registerModal";
    if(msg) {
        $(formSelector+' .success-message .msg').text(msg);
    } else {
        $(formSelector+' .success-message .msg').text(
            $(formSelector+' .success-message').attr("data-message")
        );
    }
    $(formSelector+' .success-message').stop().slideDown(200);
    if(!persistent)
        $(formSelector+' .success-message').delay(3000).slideUp(200);
}
// Hide success message immediately.
function hideSuccessMessage(formSelector) {
    if(!formSelector)
        formSelector = "#registerModal";
    $(formSelector+' .success-message').stop().hide();
}

// Check if the secret code the user entered is valid.
function checkSecretKey() {
    if($("#secretKey").val() === "")
        return;
    $.post("/access", {
        key: $("#secretKey").val()
    }).done(function(data) {
        if (data.error) {
            showErrorMessage("Error: "+data.error);
        } else {
            showSuccessMessage("Success! You entered the correct code.");
            $("#code-stuff").slideUp();
            $(".initial-signup .step2").text("Please sign in to continue");
        }
    }).fail(function() {
        showErrorMessage("An unexpected error occurred. Please try again.");
    });
}