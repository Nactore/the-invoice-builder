// Wrap all JavaScript logic in a window.onload function to ensure all libraries are loaded
window.onload = function () {
    // Get references to DOM elements
    const yourName = document.getElementById("yourName");
    const yourAddress = document.getElementById("yourAddress");
    const yourTax = document.getElementById("yourTax");
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const fileNameDisplay = document.getElementById("fileName");
    const loadingMessage = document.getElementById("loadingMessage");
    const generateInvoicesButton = document.getElementById(
        "generateInvoicesButton"
    );
    const pdfLinksContainer = document.getElementById("pdfLinks");
    const pdfList = document.getElementById("pdfList");
    const downloadZipButton = document.getElementById("downloadZip");
    const myModal = document.getElementById("myModal");
    const modalMessage = document.getElementById("modalMessage");
    const closeButton = document.getElementsByClassName("close-button")[0];
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    const today = new Date();
    const invoiceNumber = `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;

    let currentZip = new JSZip();
    let uploadedLogoDataURL = null;
    let selectedFile = null;

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
    document
        .getElementById("logoInput")
        .addEventListener("change", function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                uploadedLogoDataURL = e.target.result;
            };
            reader.readAsDataURL(file);
        });

    // Add event listeners for drag and drop functionality
    ["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    ["dragenter", "dragover"].forEach((event) => {
        dropZone.addEventListener(event, () =>
            dropZone.classList.add("highlight")
        );
    });
    ["dragleave", "drop"].forEach((event) => {
        dropZone.addEventListener(event, () =>
            dropZone.classList.remove("highlight")
        );
    });

    // Handle file drop event
    dropZone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) processFileSelection(files[0]);
    });
    // Enable click to open file dialog
    dropZone.addEventListener("click", () => fileInput.click());
    // Handle file selection from input
    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (files.length > 0) processFileSelection(files[0]);
    });

    /**
     * Processes the selected Excel file by storing it and updating UI.
     * @param {File} file - The Excel file selected.
     */
    function processFileSelection(file) {
        selectedFile = file;
        fileNameDisplay.textContent = `Selected: ${file.name}`;
        generateInvoicesButton.disabled = false;
        pdfLinksContainer.classList.add("hidden"); // Hide previous links
        pdfList.innerHTML = ""; // Clear previous list
    }

    // Event listener for the "Generate PDFs" button
    generateInvoicesButton.addEventListener("click", generatePdfs);

    /**
     * Generates and downloads PDFs from the Excel file using jsPDF and html2canvas.
     */
    async function generatePdfs() {
        if (!selectedFile) {
            showModal("Please select an Excel file first.");
            return;
        }

        loadingMessage.classList.remove("hidden"); // Show loading message
        pdfLinksContainer.classList.add("hidden"); // Hide previous links
        pdfList.innerHTML = ""; // Clear previous list

        currentZip = new JSZip(); // Reinitialize ZIP for each generation

        const reader = new FileReader();
        reader.onload = async (e) => {
            let workbook;
            try {
                const data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, { type: "array" });
            } catch (error) {
                console.error("Error reading or parsing Excel file:", error);
                showModal(
                    "Failed to read or parse the Excel file. Please ensure it is a valid .xlsx or .xls file."
                );
                loadingMessage.classList.add("hidden");
                return;
            }

            // Define PDF-specific CSS styles for inline injection
            const pdfStyles = `
              body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
              .invoice-container {
                  padding: 40px;
                  width: 800px; /* Fixed width for consistent invoice display */
                  background: white;
                  box-shadow: none;
                  margin: 0 auto;
              }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              td, th { border: 1px solid #e5e7eb; padding: 12px; text-align: center; }
              th { background-color: #ede9fe; font-weight: 600; color: #5b21b6; }
              .right { text-align: right; }
              .logo { max-width: 150px; max-height: 100px; object-fit: contain; }
              .invoice-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 40px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #a78bfa;
                  flex-wrap: wrap;
                  margin-top: 0 !important;
                  padding-top: 0 !important;
              }
              .invoice-header h1 { font-size: 2.5rem; color: #5b21b6; margin-bottom: 10px; margin-top: 0 !important; }
              .invoice-header p { font-size: 0.9rem; color: #4b5563; line-height: 1.5; margin-top: 0 !important; }
              .invoice-title-block { flex-grow: 1; max-width: calc(100% - 160px); }
            `;

            for (const sheetName of workbook.SheetNames) {
                console.log("Processing sheet:", sheetName); // Debugging: Log sheet processing
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet);
                if (!rows.length) {
                    console.warn(`Sheet "${sheetName}" is empty, skipping.`);
                    continue;
                }

                const clientMeta = rows[0];
                const items = rows.filter((row) => row.Description);

                if (!items.length) {
                    console.warn(
                        `Sheet "${sheetName}" contains no items with a description, skipping invoice generation.`
                    );
                    continue;
                }

                const pages = paginateItems([...items]);
                console.log("Number of pages generated for sheet:", sheetName, pages.length); // Debugging: Number of logical pages
                const pdf = new jspdf.jsPDF('p', 'pt', 'a4'); // Create new PDF for EACH client

                for (let i = 0; i < pages.length; i++) {
                    const pageItems = pages[i];
                    const isFirstPage = i === 0;
                    const isLastPage = i === pages.length - 1;

                    // Generate HTML for *this specific page* of the invoice
                    const pageHtmlContent = generateInvoiceContentHTML(
                        clientMeta,
                        pageItems,
                        isFirstPage, // Include header ONLY on the first page
                        isLastPage ? items : null // Only calculate grand total on the last physical page
                    );

                    // Create a temporary div for this single invoice page
                    const tempDiv = document.createElement('div');
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px';
                    tempDiv.style.top = '-9999px';
                    tempDiv.style.width = '800px'; // Important: match the invoice-container width
                    tempDiv.style.overflow = 'hidden';
                    tempDiv.innerHTML = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                          <title>Invoice Page ${i + 1} - ${sheetName}</title>
                          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                          <style>${pdfStyles}</style>
                      </head>
                      <body>
                          ${pageHtmlContent}
                      </body>
                      </html>
                  `;
                    document.body.appendChild(tempDiv);

                    try {
                        const canvas = await html2canvas(tempDiv, {
                            scale: 2,
                            logging: false,
                            useCORS: true,
                            y: 0, // Ensure capture starts at top
                        });
                        const imgData = canvas.toDataURL('image/jpeg', 1.0);

                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();

                        // Calculate scaled dimensions to fit the PDF width
                        const imgScaledWidth = pdfWidth;
                        const imgScaledHeight = (canvas.height * imgScaledWidth) / canvas.width;

                        if (i > 0) { // Add new page if it's not the first conceptual page of the invoice
                            pdf.addPage();
                            console.log(`Added new PDF page for logical page ${i + 1}`); // Debugging
                        }
                        pdf.addImage(imgData, 'JPEG', 0, 0, imgScaledWidth, imgScaledHeight); // Add image to PDF page at 0,0
                        console.log(`Image added to PDF for logical page ${i + 1} at (0,0) with scaled dimensions.`); // Debugging

                    } catch (error) {
                        console.error(
                            "Error generating PDF page for sheet:",
                            sheetName,
                            "page:", i + 1,
                            error
                        );
                        showModal(
                            `Failed to generate PDF page ${i + 1} for sheet: ${sheetName}. Please check data.`
                        );
                        break; // Stop processing this client if a page fails
                    } finally {
                        document.body.removeChild(tempDiv);
                    }
                } // End of pages loop

                if (pages.length > 0) { // Only save if at least one page was processed successfully
                    const pdfBlob = pdf.output('blob');
                    const filename = `${sheetName}_invoice.pdf`;
                    currentZip.file(filename, pdfBlob);
                    console.log("PDF generated for:", filename); // Debugging: Log successful PDF generation

                    const url = URL.createObjectURL(pdfBlob);
                    const li = document.createElement("li");
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.textContent = `Download PDF (${filename})`;
                    a.className = "text-blue-600 hover:text-blue-800 underline transition-colors duration-200";
                    li.appendChild(a); // FIX: Append 'a' to 'li' here
                    pdfList.appendChild(li);
                }
            } // End of sheet loop

            console.log("Current PDF list children count:", pdfList.children.length); // Debugging: Final check of list length

            if (pdfList.children.length > 0) {
                pdfLinksContainer.classList.remove("hidden");
                console.log("PDF links container is now visible."); // Debugging: Confirm visibility change
            } else {
                showModal(
                    "No PDFs could be generated from the provided Excel file. Please check the data format."
                );
            }
            loadingMessage.classList.add("hidden");
        };

        reader.readAsArrayBuffer(selectedFile);
    }

    // Event listener for downloading all PDFs as a ZIP file
    downloadZipButton.addEventListener("click", async () => {
        try {
            const content = await currentZip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "invoices.zip";
            link.click();
        }
        catch (error) {
            console.error("Error generating ZIP:", error);
            showModal(
                "Failed to create ZIP file. This might happen if no PDFs were successfully generated."
            );
        }
    });

    /**
     * Paginate invoice items into pages, with different limits for the first page.
     * @param {Array} items - The array of invoice items.
     * @returns {Array} An array of item pages.
     */
    function paginateItems(items) {
        const pages = [];
        let first = true;
        while (items.length) {
            // First page has 10 items, subsequent pages have 15 items
            pages.push(items.splice(0, first ? 10 : 15));
            first = false;
        }
        return pages;
    }

    /**
     * Generates the HTML content for a single invoice page with inline styles.
     * @param {Object} meta - Client metadata from the Excel file.
     * @param {Array} items - Array of invoice items for the current page.
     * @param {boolean} includeHeader - Whether to include the client header on this page.
     * @param {Array|null} fullItemList - The complete list of items to calculate grand total (only passed for the last page).
     * @returns {string} The HTML string for the invoice page.
     */
    function generateInvoiceContentHTML(
        meta,
        items,
        includeHeader,
        fullItemList = null // Removed isPageBreak
    ) {
        const rows = items
            .map((item) => {
                const hours = parseFloat(item.Hours) || 1;
                const rate = parseFloat(item.Rate || 0);
                const lineTotal = hours * rate;
                return `
                <tr>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">${item.Description || "N/A"
                    }</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">${item.Hours ? item.Hours : "Fixed"
                    }</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">$${rate.toFixed(
                        2
                    )}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">$${lineTotal.toFixed(
                        2
                    )}</td>
                </tr>
              `;
            })
            .join("");

        const grandTotal = fullItemList
            ? fullItemList.reduce(
                (acc, row) =>
                    acc + (parseFloat(row.Hours) || 1) * parseFloat(row.Rate || 0),
                0
            )
            : null;

        const logoHTML = uploadedLogoDataURL
            ? `<img src="${uploadedLogoDataURL}" alt="Company Logo" class="logo" style="max-width: 150px; max-height: 100px; object-fit: contain;" />`
            : "";

        // Conditionally render the entire client info block or nothing
        const headerContent = includeHeader
            ? `
              <div class="invoice-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #a78bfa; flex-wrap: wrap; margin-top: 0 !important; padding-top: 0 !important;">
                <div class="invoice-title-block" style="flex-grow: 1; max-width: calc(100% - ${uploadedLogoDataURL ? "160px" : "0px"
            });">
                  <h1 style="font-size: 2.5rem; color: #5b21b6; margin-bottom: 10px; margin-top: 0 !important;">Invoice ${invoiceNumber}</h1>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5; margin-top: 0 !important;"><strong>To:</strong> ${meta["Client Name"] || "Client"
            }</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5;">${meta["Client Address"] || "Address N/A"
            }</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5;"><strong>Client Tax Number:</strong> ${meta["Tax Number"] || "N/A"
            }</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5; margin-top: 1rem;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5;"><strong>From:</strong> ${yourName.value || "Your Name"
            }</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5;">${yourAddress.value || "Your Address"
            }</p>
                  <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5;"><strong>Your Tax Number:</strong> ${yourTax.value || "Your Tax Number"
            }</p>
                </div>
                ${logoHTML}
              </div>
            `
            : // If not the first page, render an empty string for the header
            "";

        return `
            <div class="invoice-container" style="padding: 40px; font-family: 'Inter', sans-serif; width: 800px; background: white; box-shadow: none; margin: 0 auto;">
              ${headerContent}
              <table style="width: 100%; border-collapse: collapse; margin-top: ${includeHeader ? '20px' : '0px'};">
                <thead>
                  <tr>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; background-color: #ede9fe; font-weight: 600; color: #5b21b6;">Description</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; background-color: #ede9fe; font-weight: 600; color: #5b21b6;">Hours / Units</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; background-color: #ede9fe; font-weight: 600; color: #5b21b6;">Rate</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; background-color: #ede9fe; font-weight: 600; color: #5b21b6;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                  ${grandTotal !== null
                ? `<tr><td colspan="3" class="right" style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; font-size: 1.125rem; font-weight: bold;"><strong>GRAND TOTAL</strong></td><td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; font-size: 1.125rem; font-weight: bold;"><strong>$${grandTotal.toFixed(
                    2
                )}</strong></td></tr>`
                : ""
            }
                </tbody>
              </table>
              <hr style="margin-top: 20px; border-color: #e5e7eb;"/>
            </div>
          `;
    }
}; // End of window.onload