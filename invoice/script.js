// Get references to DOM elements
const yourName = document.getElementById("yourName");
const yourAddress = document.getElementById("yourAddress");
const yourTax = document.getElementById("yourTax");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileName");
const loadingMessage = document.getElementById("loadingMessage");
const pdfLinksContainer = document.getElementById("pdfLinks");
const pdfList = document.getElementById("pdfList");
const downloadZipButton = document.getElementById("downloadZip");
const generateInvoicesButton = document.getElementById(
    "generateInvoicesButton"
);
const myModal = document.getElementById("myModal");
const modalMessage = document.getElementById("modalMessage");
const closeButton = document.getElementsByClassName("close-button")[0];
const modalCloseBtn = document.getElementById("modalCloseBtn");
const today = new Date();
const invoiceNumber = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;


// Declared with 'let' so it can be reassigned to a new instance for each generation
let currentZip = new JSZip();
let uploadedLogoDataURL = null; // Variable to store the logo as a Data URL
let selectedFile = null; // Variable to store the selected Excel file

/**
 * Displays a custom modal message instead of alert().
 * @param {string} message - The message to display in the modal.
 */
function showModal(message) {
    modalMessage.textContent = message;
    myModal.style.display = "flex"; // Use flex to center
}

// Close modal events
closeButton.onclick = function () {
    myModal.style.display = "none";
};
modalCloseBtn.onclick = function () {
    myModal.style.display = "none";
};
window.onclick = function (event) {
    if (event.target == myModal) {
        myModal.style.display = "none";
    }
};

// Event listener for company logo input
// document
//     .getElementById("logoInput")
//     .addEventListener("change", function (event) {
//         const file = event.target.files[0]; // Get the selected file
//         if (!file) return; // If no file selected, exit
//         const reader = new FileReader(); // Create a FileReader instance
//         reader.onload = function (e) {
//             uploadedLogoDataURL = e.target.result; // Store the Data URL
//         };
//         reader.readAsDataURL(file); // Read the file as a Data URL
//     });

// Add event listeners for drag and drop functionality
["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
    dropZone.addEventListener(event, (e) => {
        e.preventDefault(); // Prevent default drag behaviors
        e.stopPropagation(); // Stop event propagation
    });
});
// Add highlight class on dragenter and dragover
["dragenter", "dragover"].forEach((event) => {
    dropZone.addEventListener(event, () =>
        dropZone.classList.add("highlight")
    );
});
// Remove highlight class on dragleave and drop
["dragleave", "drop"].forEach((event) => {
    dropZone.addEventListener(event, () =>
        dropZone.classList.remove("highlight")
    );
});

// Handle file drop event
dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files; // Get dropped files
    if (files.length > 0) processFileSelection(files[0]); // Process the first file
});
// Enable click to open file dialog
dropZone.addEventListener("click", () => fileInput.click());
// Handle file selection from input
fileInput.addEventListener("change", (e) => {
    const files = e.target.files; // Get selected files
    if (files.length > 0) processFileSelection(files[0]); // Process the first file
});

/**
 * Processes the selected Excel file by storing it and updating UI,
 * but does not trigger PDF generation immediately.
 * @param {File} file - The Excel file selected.
 */
function processFileSelection(file) {
    selectedFile = file; // Store the file for later use
    fileNameDisplay.textContent = `Selected: ${file.name}`; // Display selected file name
    generateInvoicesButton.disabled = false; // Enable the generate button
    pdfLinksContainer.classList.add("hidden"); // Hide previous PDF links
    pdfList.innerHTML = ""; // Clear previous PDF list
}

// Event listener for the new "Generate Invoices" button
generateInvoicesButton.addEventListener("click", generatePdfs);

/**
 * Generates PDFs from the selected Excel file.
 * This function is now explicitly called by the "Generate Invoices" button.
 */
async function generatePdfs() {
    // Basic validation for sender information
    // if (!yourName.value || !yourAddress.value || !yourTax.value) {
    //   showModal(
    //     "Please fill in your Name, Address, and Tax Number before generating invoices."
    //   );
    //   return;
    // }

    if (!selectedFile) {
        showModal("Please select an Excel file first.");
        return;
    }

    loadingMessage.classList.remove("hidden"); // Show loading message
    pdfList.innerHTML = ""; // Clear previous PDF links

    // Reinitialize currentZip for each generation to ensure a clean slate
    currentZip = new JSZip();
    currentZip.folder("invoices"); // Create a folder inside the zip

    const reader = new FileReader(); // Create FileReader
    reader.onload = async (e) => {
        let workbook;
        try {
            const data = new Uint8Array(e.target.result); // Get file data as Uint8Array
            workbook = XLSX.read(data, { type: "array" }); // Parse Excel workbook
        } catch (error) {
            console.error("Error reading or parsing Excel file:", error);
            showModal(
                "Failed to read or parse the Excel file. Please ensure it is a valid .xlsx or .xls file."
            );
            loadingMessage.classList.add("hidden");
            return;
        }

        // Iterate through each sheet in the workbook
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]; // Get current sheet
            const rows = XLSX.utils.sheet_to_json(sheet); // Convert sheet to JSON array
            if (!rows.length) {
                console.warn(`Sheet "${sheetName}" is empty, skipping.`);
                continue; // Skip empty sheets
            }

            const clientMeta = rows[0]; // First row contains client metadata
            const items = rows.slice(1).filter((row) => row.Description); // Subsequent rows are invoice items

            if (!items.length) {
                console.warn(
                    `Sheet "${sheetName}" contains no items with a description, skipping invoice generation.`
                );
                continue;
            }

            const pages = paginateItems([...items]); // Paginate items for multi-page invoices

            let allHtml = "";
            // Generate HTML for each page of the invoice
            pages.forEach((pageItems, index) => {
                const isLast = index === pages.length - 1; // Check if it's the last page
                allHtml += generateInvoiceHTML(
                    clientMeta,
                    pageItems,
                    index === 0, // Include header only on the first page
                    index !== 0, // Add page break from second page onwards
                    isLast ? items : null // Pass full item list for grand total only on last page
                );
            });

            // Generate PDF from the accumulated HTML
            try {
                const pdfBlob = await html2pdf().from(allHtml).outputPdf("blob");
                const filename = `${sheetName}_invoice.pdf`; // Define PDF filename
                currentZip.file(filename, pdfBlob); // Add PDF to the ZIP archive using currentZip

                // Create a downloadable link for the generated PDF
                const url = URL.createObjectURL(pdfBlob);
                const li = document.createElement("li");
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.textContent = `Download PDF (${filename})`;
                a.className =
                    "text-blue-600 hover:text-blue-800 underline transition-colors duration-200";
                li.appendChild(a);
                pdfList.appendChild(li);
            } catch (error) {
                console.error(
                    "Error generating PDF for sheet:",
                    sheetName,
                    error
                );
                showModal(
                    `Failed to generate PDF for sheet: ${sheetName}. Please check the Excel data structure.`
                );
            }
        }

        // Only show pdfLinksContainer if any PDFs were successfully generated
        if (pdfList.children.length > 0) {
            pdfLinksContainer.classList.remove("hidden");
        } else {
            // If no PDFs were generated, provide a specific message
            showModal(
                "No invoices could be generated from the provided Excel file. Please check the data format."
            );
        }
        loadingMessage.classList.add("hidden"); // Hide loading message
    };

    reader.readAsArrayBuffer(selectedFile); // Read the stored file as an ArrayBuffer
}

// Event listener for downloading all PDFs as a ZIP file
downloadZipButton.addEventListener("click", async () => {
    try {
        // Use currentZip, not the global 'zip' if it was not correctly reassigned
        const content = await currentZip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content); // Create URL for the blob
        link.download = "invoices.zip"; // Set download filename
        link.click(); // Programmatically click the link to trigger download
    } catch (error) {
        console.error("Error generating ZIP:", error);
        showModal(
            "Failed to create ZIP file. This might happen if no PDFs were successfully generated."
        );
    }
});

/**
 * Paginate invoice items into pages, with different limits for the first page.
 * @param {Array} items - The array of invoice items.
 * @returns {Array<Array>} An array of item pages.
 */
function paginateItems(items) {
    const pages = [];
    let first = true; // Flag for the first page
    while (items.length) {
        // First page has 10 items, subsequent pages have 15 items
        pages.push(items.splice(0, first ? 10 : 15));
        first = false; // Reset flag after the first page
    }
    return pages;
}

/**
 * Generates the HTML content for a single invoice page.
 * @param {Object} meta - Client metadata from the Excel file.
 * @param {Array} items - Array of invoice items for the current page.
 * @param {boolean} includeHeader - Whether to include the client header on this page.
 * @param {boolean} isPageBreak - Whether to add a page break before this container.
 * @param {Array|null} fullItemList - The complete list of items to calculate grand total (only passed for the last page).
 * @returns {string} The HTML string for the invoice page.
 */
function generateInvoiceHTML(
    meta,
    items,
    includeHeader,
    isPageBreak,
    fullItemList = null
) {
    let currentTotal = 0; // Total for items on current page (not used for grand total in final PDF)
    const rows = items
        .map((item) => {
            const hours = parseFloat(item.Hours) || 1; // Default to 1 if Hours is not provided or invalid
            const rate = parseFloat(item.Rate || 0); // Default to 0 if Rate is not provided or invalid
            const lineTotal = hours * rate; // Calculate line item total
            currentTotal += lineTotal; // Accumulate total for current page
            return `
      <tr>
        <td>${item.Description || "N/A"}</td>
        <td>${item.Hours ? item.Hours : "Fixed"}</td>
        <td>$${rate.toFixed(2)}</td>
        <td>$${lineTotal.toFixed(2)}</td>
      </tr>
    `;
        })
        .join("");

    // Calculate grand total if fullItemList is provided (i.e., on the last page)
    const grandTotal = fullItemList
        ? fullItemList.reduce(
            (acc, row) =>
                acc + (parseFloat(row.Hours) || 1) * parseFloat(row.Rate || 0),
            0
        )
        : null;

    // HTML for logo if uploaded
    const logoHTML = uploadedLogoDataURL
        ? `<img src="${uploadedLogoDataURL}" alt="Company Logo" class="logo" />`
        : "";

    // Client information section, only included if includeHeader is true
    const clientInfo = includeHeader
        ? `
    <div class="invoice-header">
      ${logoHTML}
      <h1 class="text-4xl font-bold mb-2">Invoice ${invoiceNumber}</h1>
      <p><strong>To:</strong> ${meta["Client Name"] || "Client"
        }</p>
      <p>${meta["Client Address"] || "Address N/A"}</p>
      <p><strong>Client Tax Number:</strong> ${meta["Tax Number"] || "N/A"
        }</p>
      <p class="mt-4"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>From:</strong> ${yourName.value || "Your Name"}</p>
      <p>${yourAddress.value || "Your Address"}</p>
      <p><strong>Your Tax Number:</strong> ${yourTax.value || "Your Tax Number"
        }</p>
    </div>
  `
        : "";

    return `
    <div class="invoice-container ${isPageBreak ? "page-break" : ""}">
      ${clientInfo}
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Hours / Units</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${
        // Display grand total row only if fullItemList is provided
        grandTotal !== null
            ? `<tr><td colspan="3" class="right text-lg font-bold"><strong>GRAND TOTAL</strong></td><td class="text-lg font-bold"><strong>$${grandTotal.toFixed(
                2
            )}</strong></td></tr>`
            : ""
        }
        </tbody>
      </table>
      <hr/>
      <p style="text-align: center; font-size: 12px; color: #666;">
  Want this to be customized? Contact: harshiljani2002@gmail.com
</p>

    </div>
  `;
}
